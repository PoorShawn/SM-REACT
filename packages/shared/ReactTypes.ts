export type Type = any;
export type Key = any;
export type Ref = any;
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  type: ElementType; // 原生组件类型
  key: Key;
  ref: Ref;
  props: Props;
  __mark: string; // 区别于官方React
}

export type Action<State> = State | ((preState: State) => State);