import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { FiberNode } from "./fiber";
import internals from "shared/internals";
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, UpdateQueue } from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

const { currentDispatcher } = internals;

interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置
  wip.memoizedState = null; // 为存储 Hooks 链表作准备

  const current = wip.alternate;

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const component = wip.type;
  const props = wip.pendingProps;
  const children = component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;

  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到 useState 对应的 hook 的数据
  const hook = updateWorkInProgressHook();

  // 计算新的 state
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;

  if (pending !== null) {
    const { memoizedState } = processUpdateQueue(hook.memoizedState, pending);
    hook.memoizedState = memoizedState;
  }
  
  return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

function updateWorkInProgressHook(): Hook {
  // TODO 处理 render 阶段触发的更新
  let nextCurrentHook: Hook | null;

  if (currentHook === null) {
    // 该 FC update 时的第一个 hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 该 FC update 时的后续 hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) {
    throw new Error( `组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次多`);
  }

  currentHook = nextCurrentHook as Hook;

  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null
  }

  if (workInProgressHook === null) {
    // mount, 且为第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用 Hook !')
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount, 为后续的 hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }

  return workInProgressHook;
}

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到 useState 对应的 hook 的数据
  const hook = mountWorkInProgressHook();
  let memoizedState;

  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  // 更新调度
  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
  queue.dispatch = dispatch;
  
  return [memoizedState, dispatch]
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action);

  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook() {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null
  }

  if (workInProgressHook === null) {
    // mount, 且为第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用 Hook !')
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount, 为后续的 hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }

  return workInProgressHook;
}