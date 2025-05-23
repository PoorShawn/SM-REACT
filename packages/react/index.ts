import currentDispatcher, { Dispatcher, resolveDispatcher } from './src/currentDispatcher'
import { jsxDEV, jsx, isValidElement as isValidElementFn} from './src/jsx'

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

// 内部数据共享层
export const __SECRET_INTERNALS = {
  currentDispatcher
}

export const version = '0.0.0';

// TODO 根据环境区分使用 jsx/jsxDEV
export const createElement = jsx;

export const isValidElement = isValidElementFn;