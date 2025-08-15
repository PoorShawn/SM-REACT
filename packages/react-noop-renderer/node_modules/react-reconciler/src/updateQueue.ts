import { Dispatch } from "react/src/currentDispatcher";
import { Action } from "shared/ReactTypes";
import { Lane } from "./fiberLanes";

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
): { memoizedState: State} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };

  if (pendingUpdate !== null) {
    const first = pendingUpdate.next;  // 首个 update
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pending.action;
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error("当前 pending.lane !== renderLane");
        }
      }

      pending = pending.next as Update<any>;
    } while(pending !== first);
  }

  result.memoizedState = baseState;
  return result;
}