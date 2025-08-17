import { Dispatch } from "react/src/currentDispatcher";
import { Action } from "shared/ReactTypes";
import { isSubsetOfLanes, Lane, NoLane } from "./fiberLanes";

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => { // 使用函数级泛型参数
  return {
    action,
    lane,
    next: null
  }
}

export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>
}

export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    update.next = update;  // 环状链表
  } else {
    // 往环状链表的结尾插入元素
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;  // 指向环状链表的最后一个元素
}

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  };

  if (pendingUpdate !== null) {
    const first = pendingUpdate.next;  // 首个 update
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState;  // 第一个被跳过 update 的前一个值
    let newBaseQueueFirst: Update<State> | null = null;  // 第一个被跳过的 update 以及其后续的完整链表
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;  // 不断被计算更新的值

    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 当前的 update 优先级不够,被跳过
        const clone = createUpdate(pending.action, pending.lane);

        // 判断是否为更新链表中第一个被跳过的 update
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

      } else {
        // 当前的 update 优先级足够

        // 判断之前的 update 是否有被跳过
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        const action = pending.action;
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          newState = action;
        }
      }

      pending = pending.next as Update<any>;
    } while(pending !== first);

    // 判断此次更新流程中，是否存在 update 被跳过的情况
    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }

    result.memoizedState = newState;  // 考虑优先级情况下计算的结果
    result.baseState = newBaseState;  // 最后一个没有被跳过的 update 的计算结果
    result.baseQueue = newBaseQueueLast;
  }
  
  return result;
}