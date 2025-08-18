import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import currentBatchConfig from "react/src/currentBatchConfig";
import { FiberNode } from "./fiber";
import internals from "shared/internals";
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, Update, UpdateQueue } from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTags";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;  // 指向 effect 环状链表的最后一个元素
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;
export interface Effect {
  tag: Flags;  // 标志是哪种副作用
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置
  wip.memoizedState = null; // 为存储 Hooks 链表作准备
  wip.updateQueue = null;  // 重置 effect 链表
  renderLane = lane;

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
  renderLane = NoLane;

  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps: any[] | null = deps === undefined ? null : (deps as any[] | null);
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  )
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgressHook();
    const nextDeps: any[] | null = deps === undefined ? null : (deps as any[] | null);
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const preEffect = currentHook.memoizedState as Effect;
    destroy = preEffect.destroy;

    if (nextDeps !== null) {
      const preDeps = preEffect.deps;
      if (areHookInputsEqual(nextDeps, preDeps)) {
        // 浅比较后，相等
        hook.memoizedState = pushEffect(
          Passive,
          create,
          destroy,
          nextDeps
        );
        return;
      }
    }

    // 浅比较后，不相等
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, preDeps: EffectDeps) {
  if (preDeps === null || nextDeps === null) {
    return false;
  }

  for (let i = 0; i < preDeps.length && i < nextDeps.length; i++) {
    if (Object.is(preDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }

  return true;
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  console.log('pushEffect')
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  }

  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    // 首次创建 updateQueue
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      // 首次创建 effect 环状链表
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      // 往 effect 环状链表中插入 当前的 effect
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }

  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到 useState 对应的 hook 的数据
  const hook = updateWorkInProgressHook();

  // 计算新的 state
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;
  const baseState = hook.baseState;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pending !== null) {
    // 把 pending 和 baseQueue 中的 update 链表合并
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;

      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }

    baseQueue = pending;
    current.baseQueue = pending;  // 保存在 current 中
    queue.shared.pending = null;
  }

  if (baseQueue !== null) {
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState
    } = processUpdateQueue(
      baseState,
      baseQueue,
      renderLane
    );

    hook.memoizedState = memoizedState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueue;
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
    next: null,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue
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

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setPending);
  hook.memoizedState = start;

  return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState<boolean>();
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;

  return [isPending, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true);
  const preTransition = currentBatchConfig.transition;
  currentBatchConfig.transition = 1;

  callback();
  setPending(false);

  currentBatchConfig.transition = preTransition;
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
  hook.baseState = memoizedState;

  hook.memoizedState = memoizedState;

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
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);

  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook() {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
    baseState: null,
    baseQueue: null
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