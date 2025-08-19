import { appendChildToContainer, commitUpdate, Container, insertChildToContainer, Instance, removeChild } from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import { ChildDeletion, Flags, LayoutMask, MutationMask, NoFlags, PassiveEffect, PassiveMask, Placement, Ref, Update } from "./fiberFlags";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./wokTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";

// 指向下一个需要执行 effect 的 FiberNode
let nextEffect: FiberNode | null = null;

export const commitEffects = (
  phrase: 'mutation' | 'layout',
  mask: Flags,
  callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork;

    while (nextEffect !== null) {
      const child: FiberNode | null = nextEffect.child;

      if (child !== null && (nextEffect.subtreeFlags & mask) !== NoFlags) {
        // 向下遍历
        nextEffect = child;
      } else {
        // 先尝试遍历兄弟节点，然后再向上遍历
        up: while (nextEffect !== null) {
          callback(nextEffect, root);

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
}

const commitMutationEffectsOnFiber = (finishedWork: FiberNode, root: FiberRootNode) => {
  const { flags, tag } = finishedWork;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    // 从 flags 中，清除 Placement 标记
    finishedWork.flags &= ~Placement;
  }

  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    // 从 flags 中，清除 Update 标记
    finishedWork.flags &= ~Update;
  }

  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete, root);
      })
    }
    // 从 flags 中，清除 ChildDeletion 标记
    finishedWork.flags &= ~ChildDeletion;
  }

  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, 'update');
    // 从 flags 中，清除 PassiveEffect 标记
    finishedWork.flags &= ~PassiveEffect;
  }

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    safelyDetachRef(finishedWork);
  }
}

export const commitMutationEffects = commitEffects(
  'mutation',
  MutationMask | PassiveEffect,
  commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
  'layout',
  LayoutMask,
  commitLayoutEffectsOnFiber
)

function commitLayoutEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
  const { flags, tag } = finishedWork;

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 绑定新的 ref
    safelyAttachRef(finishedWork);
    finishedWork.flags &= ~Ref;
  }
}

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref;
  if (ref !== null) {
    const instance = fiber.stateNode;
    if (typeof ref === 'function') {
      ref(instance);
    } else {
      ref.current = instance;
    }
  }
}

function safelyDetachRef(current: FiberNode) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}

function commitPassiveEffect(fiber: FiberNode, root: FiberRootNode, type: keyof PendingPassiveEffects) {
  if (fiber.tag !== FunctionComponent || (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)) {
    return;
  }

  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error('当 FC 被标记 PassiveEffect 时，updateQueue 中应该存在 effect 回调函数')
    }

    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

function commitHookEffectList(flags: Flags, lastEffect: Effect, callback: (effect: Effect) => void) {
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }

    // 当某个组件被卸载时，后续的 effect 的有关更新的回调都不需要执行
    effect.tag &= ~HookHasEffect;
  })
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
  })
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const create = effect.create;
    if (typeof create === 'function') {
      effect.destroy = create();
    }
  })
}

function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 找到第一个 root host 节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1];

  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !==null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];

  // 递归子树
  commitNestedComponent(childToDelete, unmountFiber => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        safelyDetachRef(unmountFiber);
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        commitPassiveEffect(unmountFiber, root, 'unmount');
        return;
      default:
        if (__DEV__) {
          console.warn('未处理的 unmount 类型：', unmountFiber);
        }
    }
  })

  // 移除 rootHostNode 的 DOM
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);

    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      })
    }
  }

  // 为了方便 JS 进行垃圾回收
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    // 向下遍历
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    // 终止条件
    if (node === root) {
      return;
    }

    while (node.sibling === null) {
      // 终止条件
      if (node.return === null || node.return === root) {
        return;
      }

      // 向上遍历
      node = node.return;
    }

    // 遍历兄弟节点
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行 Placement 操作', finishedWork);
  }

  // 找到 parent 宿主节点
  const hostParent = getHostParent(finishedWork);

  // 找到 sibling 宿主节点
  const sibling = getHostSibling(finishedWork);

  // 把 子宿主节点 append 到 parent 宿主节点
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
}

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    // 若子节点和兄弟节点中都不存在 host sibling 节点，则尝试向上寻找
    while (node.sibling === null) {
      const parent = node.return;

      if (parent === null || parent.tag === HostComponent || parent.tag === HostRoot) {
        return null;
      }

      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    // 尝试向下遍历寻找
    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 若该节点是需要插入或者移动的，则不可依靠
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }

      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
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
function insertOrAppendPlacementNodeIntoContainer (
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  // 递归遍历
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;
    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}