import { appendChildToContainer, Container } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./wokTags";

// 指向下一个需要执行 effect 的 FiberNode
let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;

    if (child !== null && (nextEffect.subtreeFlags & MutationMask) !== NoFlags) {
      // 向下遍历
      nextEffect = child;
    } else {
      // 先尝试遍历兄弟节点，然后再向上遍历
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);

        const sibling: FiberNode | null = nextEffect.sibling;

        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
}

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    // 从 flags 中，清除 Placement 标记
    finishedWork.flags &= ~Placement;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行 Placement 操作', finishedWork);
  }

  // 找到 parent 宿主节点
  const hostParent = getHostParent(finishedWork);
  // 把 子宿主节点 append 到 parent 宿主节点
  if (hostParent !== null) {
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
  }
}

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;

  // 向上遍历寻找，直到找到宿主环境的节点
  while (parent) {
    const parentTag = parent.tag;

    // HostComponent
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }

    // HostRoot
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }

    parent = parent.return;
  }

  if (__DEV__) {
    console.warn('未找到 host parent');
  }

  return null;
}

// 向下遍历，只添加宿主环境的子节点
function appendPlacementNodeIntoContainer (
  finishedWork: FiberNode,
  hostParent: Container
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }

  // 递归遍历
  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;
    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}