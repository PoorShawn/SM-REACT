import { Props, ReactElementType } from "shared/ReactTypes";
import { createFiberFromElement, createWorkInProgress, FiberNode } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./wokTags";
import { ChildDeletion, Placement, Update } from "./fiberFlags";

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

  function reconcileSingleElement (
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    // update
    work: if (currentFiber !== null) {
      // key 相同的情况下
      if (currentFiber.key === element.key) {
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          // type 相同的情况下
          if (currentFiber.type === element.type) {
            // 复用子节点
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }

          // 无法复用子节点
          deleteChild(returnFiber, currentFiber);
          break work;
        } else {
          if (__DEV__) {
            console.warn('当前未实现的 element 类型：', element);
            break work;
          }
        }
      } else {
        // 删除旧节点
        deleteChild(returnFiber, currentFiber);
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
    if (currentFiber !== null) {
      // 类型不变的情况下
      if (currentFiber.tag === HostText) {
        // 复用子节点
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        // existing.flags |= Update;
        return existing;
      }

      deleteChild(returnFiber, currentFiber);
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
    }

    // TODO: 处理多个子节点的情况

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