import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { createWorkInProgress, FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { HostRoot } from "./wokTags";

let workInProgress: FiberNode | null = null; // 当前正在处理的 Fiber 节点 

function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, {});
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {
  // TODO: 调度功能
  const root = markUpdateFromFiberRoot(fiber);
  renderRoot(root);
}

// 一直向上寻找，直到 FiberRootNode
function markUpdateFromFiberRoot(fiber: FiberNode) {
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

function renderRoot(root: FiberRootNode) {
  // 初始化
  prepareFreshStack(root);
  
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
  } while (true); // 这里为什么需要用一个死循环

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;

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

  // 重置
  root.finishedWork = null;

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
  const next = beginWork(fiber); // 生成和向下遍历子节点
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