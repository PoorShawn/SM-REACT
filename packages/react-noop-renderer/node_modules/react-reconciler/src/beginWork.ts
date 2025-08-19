// 递归中的递阶段

import { ReactElementType } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./wokTags";
import { mountChildFiber, reconcilerChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import { Ref } from "./fiberFlags";

// 将 ReactElement 和 FiberNode 进行比较，并返回子 FiberNode
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    case Fragment:
      return updateFragment(wip);
    default:
      if (__DEV__) {
        console.warn('beginWork 未实现的类型: ', wip.tag)
      }
      break;
  }

  return null;
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;

  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);

  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;  // 首屏渲染不存在更新被中断的情况

  // 计算状态的最新值
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memoizedState = memoizedState;

  const nextChildren = wip.memoizedState;
  // 将 current fiberNode 和 ReactElement 进行对比，返回子节点
  reconcileChildren(wip, nextChildren);

  return wip.child;
}

function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  markRef(wip.alternate, wip);
  reconcileChildren(wip, nextChildren);

  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;

  if (current !== null) {
    // update，以及 mount 时针对的 hostRootFiber
    wip.child = reconcilerChildFibers(wip, current?.child, children);
  } else {
    // mount
    wip.child = mountChildFiber(wip, null, children);
  }
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref;

  if (
    (current === null && ref !== null) ||  // mount，且存在 ref
    (current !== null && current.ref !== ref)  // update，且 ref 引用发生变化
  ) {
    workInProgress.flags |= Ref;
  }
}

