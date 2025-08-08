import { Props, ReactElementType } from "shared/ReactTypes";
import { createFiberFromElement, createWorkInProgress, FiberNode } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./wokTags";
import { ChildDeletion, Placement, Update } from "./fiberFlags";

type ExistingChildren = Map<string | number, FiberNode>;

// 根据是否追踪副作用，决定返回使用的方法
function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }

    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function deleteRemainingChildren(returnFiber: FiberNode, currentFirstChild: FiberNode | null) {
    if (!shouldTrackEffects) {
      return;
    }

    let childToDelete  = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  function reconcileSingleElement (
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    // update
    while (currentFiber !== null) {
      if (currentFiber.key === element.key) {
        // key 相同的情况下
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          // type 相同的情况下
          if (currentFiber.type === element.type) {
            // 复用子节点
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;

            // 标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }

          // key 相同，type 不同，不存在复用的可能，删去所有的旧节点
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
        } else {
          if (__DEV__) {
            console.warn('当前未实现的 element 类型：', element);
            break;
          }
        }
      } else {
        // key 不同，删除旧节点，继续遍历其他的 sibling 节点
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }

    // 根据 element 创建 fiber
    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber;
    return fiber;
  };

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    // update
    while (currentFiber !== null) {
      if (currentFiber.tag === HostText) {
        // 类型不变的情况下，复用子节点
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        // existing.flags |= Update;
        return existing;
      }

      deleteChild(returnFiber, currentFiber);
      currentFiber  = currentFiber.sibling;
    }

    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  function placeSingleChild(fiber: FiberNode) {
    // 首屏渲染 && 应该追踪副作用 的情况下
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // 当前最后一个可复用的 fiber 在 current 中的索引位置
    let lastPlacedIndex: number = 0;
    // 创建的最后一个 fiber
    let lastNewFiber: FiberNode | null = null;
    // 创建的第一个 fiber
    let firstNewFiber: FiberNode | null = null;

    // 将 current fiber 保存在 map 中
    const existingChildren: ExistingChildren = new Map();
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }
     
    // 遍历 newChild，寻找可复用
    for (let i = 0; i < newChild.length; i++) {
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

      if (newFiber === null) {
        // 找不到该 element 元素对应的可复用 fiber 节点
        continue;
      }

      // 标记节点的插入和移动
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber === null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 移动
          newFiber.flags |= Placement;
          continue;
        } else {
          // 不移动
          lastPlacedIndex = oldIndex;
        }
      } else {
        // mount 插入
        newFiber.flags |= Placement;
      }
    }

    // 将 map 中剩下的节点标记为删除
    existingChildren.forEach(fiber => {
      deleteChild(returnFiber, fiber);
    })

    return firstNewFiber;
  }

  // 从子节点数组中，判断是否可复用
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);

    // 当前的 element 元素是 HostText 类型
    if (typeof element === 'string' || typeof element === 'number') {
      if (before) {
        if (before.tag === HostText) {
          // 可复用的 fiber 节点存在
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + '' });
        }
      }

      // 若不能复用，则创建一个新节点
      return new FiberNode(HostText, { content: element + '' }, null);
    }

    // 当前的 element 元素是 ReactElement 类型
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (before) {
            if (before.type === element.type) {
              // 存在可复用的节点
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }

          // 不能复用，则创建一个新的 element
          return createFiberFromElement(element);
      }

      // TODO: 数组类型
      if (Array.isArray(element) && __DEV__) {
        console.warn('还未实现数组类型的 child');
      }
    }

    return null;
  }

  return function reconcilerChildFibers(
    returnFiber: FiberNode, // wip 父节点 FiberNode
    currentFiber: FiberNode | null, // current 子节点 FiberNode
    newChild?: ReactElementType // 子节点的 ReactElement
  ) {
    // 只有一个子节点
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn('未实现的 reconcile 类型：', newChild);
          }
          break;
      }

      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }
    }

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底删除
    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn('未实现的 reconcile 类型：', newChild);
    }

    return null;
  };
}

// 复用某个 fiber 节点
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

export const reconcilerChildFibers = ChildReconciler(true);
// 在 mount 阶段，不希望追踪副作用，从而进行性能优化
export const mountChildFiber = ChildReconciler(false);