import { ReactElementType } from "shared/ReactTypes";
import { createFiberFromElement, FiberNode } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./wokTags";
import { Placement } from "./fiberFlags";

// 根据是否追踪副作用，决定返回使用的方法
function ChildReconciler(shouldTrackEffects: boolean) {
  function reconcileSingleElement (
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
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
    // 判断当前 fiber 的类型
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

    // TODO: 处理多节点的情况

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    if (__DEV__) {
      console.warn('未实现的 reconcile 类型：', newChild);
    }

    return null;
  };
}

export const reconcilerChildFibers = ChildReconciler(true);
// 在 mount 阶段，不希望追踪副作用，从而进行性能优化
export const mountChildFiber = ChildReconciler(false);