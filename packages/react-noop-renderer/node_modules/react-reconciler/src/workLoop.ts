import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitHookEffectListCreate, commitHookEffectListDestroy, commitHookEffectListUnmount, commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { createWorkInProgress, FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import { getHighestPriorityLane, Lane, lanesToSchedulerPriority, markRootFinished, mergeLanes, NoLane, SyncLane } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./wokTags";
import { unstable_scheduleCallback as scheduleCallback, unstable_NormalPriority as normalPriority, unstable_shouldYield, unstable_cancelCallback } from 'scheduler';
import { HookHasEffect, Passive } from "./hookEffectTags";

let workInProgress: FiberNode | null = null; // 当前正在处理的 Fiber 节点 
let wipRootRenderLane: Lane = NoLane;  // 当前正在处理的任务的优先级
let rootDoesHasPassiveEffects: Boolean = false;

type RootExistStatus = number;
const RootInComplete = 1;
const RootCompleted = 2;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;

  root.finishedLane = NoLane;
  root.finishedWork = null;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberRoot(fiber);
  if (root === null) {
    return;
  }

  markRootUpdated(root, lane);
  // renderRoot(root);
  ensureRootIsScheduled(root);
}

// 调度阶段的入口
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);  // 从当前的任务优先级队列中，取出最高的优先级
  const existingCallback = root.callbackNode;  // 取出当前正在被调度的回调函数
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }

    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prePriority = root.callbackPriority;

  // 若当前需要调度的任何和之前的任务优先级相同，则不打断
  if (curPriority === prePriority) {
    return;
  }

  // 此时，当前任务的优先级比之前调度的任务的优先级高
  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback);
  }

  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // 同步优先级，使用微任务进行调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级：', updateLane);
    }

    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级，使用宏任务进行调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(schedulerPriority, performConcurrentWorkOnRoot.bind(null, root));
  }

  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 一直向上寻找，直到 FiberRootNode
function markUpdateFromFiberRoot(fiber: FiberNode): FiberRootNode | null {
  let node = fiber;
  let parent = node.return;

  while(parent !== null) {
    node = parent;
    parent = node.return;
  }

  if (node.tag === HostRoot) {
    return node.stateNode;
  }

  return null;
}

function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean) {
  // 保证 useEffect 中的回调都已经执行
  const curCallback = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {
      // useEffect 回调触发的更新比当前更新的优先级更高
      return null;
    }
  }
  
  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  if (lane === NoLane) {
    return null;
  }

  const needSync = lane === SyncLane || didTimeout;
  const existStatus = renderRoot(root, lane, !needSync);
  ensureRootIsScheduled(root);

  // 中断
  if (existStatus === RootInComplete) {
    // 被更高优先级的任务打断
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }

    // 由于当前时间不足而被打断
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  // 顺利完成，未中断
  if (existStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现异步更新结束状态');
  }

}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    ensureRootIsScheduled(root);
    return;
  }

  const existStatus = renderRoot(root, nextLane, false);

  if (existStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现同步更新结束状态');
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始 ${shouldTimeSlice ? '并发' : '同步'} 更新: `, root);
  }

  if (wipRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane);
  }
  
  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop 发生错误', e);
      }
      workInProgress = null;
    }
  } while (true);

  // 并发的中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }

  // render 阶段执行结束
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('render 阶段结束时, wip 不应该不是 null');
  }
  return RootCompleted;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn('commit 阶段开始', finishedWork);
  }

  const lane = root.finishedLane;

  if (lane === NoLane && __DEV__) {
    console.error('commit 阶段 finishedLane 不应是 NoLane')
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    // 当前的函数组件中需要执行 useEffect 的回调函数
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      scheduleCallback(normalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      })
    }
  }

  // 判断是否存在 3 个子阶段需要执行的操作
  const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation 阶段

    // mutation 阶段
    commitMutationEffects(finishedWork, root);

    // fiber 树的切换
    root.current = finishedWork;

    // layout 阶段
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects): boolean {
  let didFlushPassiveEffect = false;
  
  // 首先执行所有的 unmount 回调
  pendingPassiveEffects.unmount.forEach(effect => {
    commitHookEffectListUnmount(Passive, effect);
    didFlushPassiveEffect = true;
  });
  pendingPassiveEffects.unmount = [];

  // 然后触发上次更新的 destroy 回调
  pendingPassiveEffects.update.forEach(effect => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
    didFlushPassiveEffect = true;
  });

  // 再触发这次更新的 create 回调
  pendingPassiveEffects.update.forEach(effect => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
    didFlushPassiveEffect = true;
  });
  pendingPassiveEffects.update = [];

  // 上述的回调可能触发新的更新
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

function workLoopSync() {
  while(workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while(workInProgress !== null && unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane); // 生成和向下遍历子节点
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    // 向上遍历 fiber 树
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

// 不存在子节点的情况下，先尝试遍历兄弟节点，不行就往上返回父节点
function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;

  do {
    completeWork(node)

    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }

    node = node.return;
    workInProgress = node;
  } while (node !== null)
}