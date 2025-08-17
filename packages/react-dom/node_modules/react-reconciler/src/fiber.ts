import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { Fragment, FunctionComponent, HostComponent, WorkTag } from './wokTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';

export class FiberNode {
  tag: WorkTag;
  pendingProps: Props | null;
  key: Key;
  stateNode: any;
  type: any;

  return: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  index: number;

  ref: Ref;

  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  flags: Flags;
  subtreeFlags: Flags;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag; // Fiber 节点的类型编号
    this.key = key || null; // Fiber 节点的唯一标识
    this.stateNode = null; // Fiber 节点对应的实例对象
    this.type = null; // Fiber 节点对应原生节点类型

    // 表示节点之间关系的属性，构成树状结构
    this.return = null; // 父节点
    this.child = null; // 子节点
    this.sibling = null; // 兄弟节点
    this.index = 0; // 子节点的索引

    this.ref = null; // Fiber 节点的 ref 属性

    // 作为工作单元的属性
    this.pendingProps = pendingProps; // Fiber 节点的 props 属性
    this.memoizedProps = null; // Fiber 节点的已记忆的 props 属性
    this.memoizedState = null; // 类组件存储 this.state 对象，函数组件存储所有 Hooks 状态
    this.updateQueue = null; // Fiber 节点的待更新队列

    this.alternate = null; // 备用 Fiber 节点

    // 副作用
    this.flags = NoFlags; // Fiber 节点的标记，用于表示需要更新的状态
    this.subtreeFlags = NoFlags; // 由子节点冒泡到父节点的 flags，进行优化
    this.deletions = null; // 记录需要被删除的子节点
  }

}

export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

export class FiberRootNode {
  container: Container; //  在网页中为 DomElement
  current: FiberNode;
  finishedWork: FiberNode | null; // 构建完成的 fiber 树
  pendingLanes: Lanes;
  finishedLane: Lane;
  pendingPassiveEffects: PendingPassiveEffects;  // 用来收集被调度的副作用 effect 回调函数

  callbackNode: CallbackNode | null;  // 当前正在被调度的回调函数
  callbackPriority: Lane;  // 当前正在被调度的任务的优先级

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;

    this.callbackNode = null;
    this.callbackPriority = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: []
    }

    hostRootFiber.stateNode = this;
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    // mount
    wip = new FiberNode(current.tag, pendingProps,current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }

  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;

  return wip;
}

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    fiberTag = HostComponent; // 为什么此时可以判断未 HostComponent ?
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义的 type 类型：', element);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}