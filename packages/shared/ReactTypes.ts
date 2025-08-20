export type Type = { current: any } | ((instance: any) => void);
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

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactProviderType<T> | null;
  _currentValue: T;
}

export type ReactProviderType<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T> | null;
}