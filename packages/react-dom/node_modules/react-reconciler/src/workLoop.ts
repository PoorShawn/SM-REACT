import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { createWorkInProgress, FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { getHighestPriorityLane, Lane, markRootFinished, mergeLanes, NoLane, SyncLane } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./wokTags";

let workInProgress: FiberNode | null = null; // 当前正在处理的 Fiber 节点 
let wipRootRenderLane: Lane = NoLane;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
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
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    return;
  }

  if (updateLane === SyncLane) {
    // 同步优先级，使用微任务进行调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级：', updateLane);
    }

    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级，使用宏任务进行调度
  }
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

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    ensureRootIsScheduled(root);
    return;
  }
  
  // 初始化
  prepareFreshStack(root, lane);
  
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop 发生错误', e);
      }
      workInProgress = null;
    }
  } while (true); // 提供高度容错性，不会因为单个错误导致整个应用的崩溃

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;

  commitRoot(root);
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

  // 判断是否存在 3 个子阶段需要执行的操作
  const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation 阶段

    // mutation 阶段
    commitMutationEffects(finishedWork);

    // fiber 树的切换
    root.current = finishedWork;

    // layout 阶段
  } else {
    root.current = finishedWork;
  }
}

function workLoop() {
  while(workInProgress !== null) {
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