import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols"
import { Type, Key, Ref, Props, ReactElementType } from "shared/ReactTypes"

// ReactElement 的构造函数：把 JSX 转换成 ReactElement 对象
const ReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: 'PoorShawn' // 区别于官方React
  }
  return element
}

export function isValidElement(object: any) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  )
}

// jsx 函数：将 JSX 通过 Babel 编译后的结果，转换成 ReactElement 对象
export const jsx = (type: Type, config: any, ...maybeChildren: any): ReactElementType => {
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};

  // 遍历 config 对象
  for (const prop in config) {
    const val = config[prop];
    if (prop === 'key' && val !== undefined) {
      key = String(val);
      continue;
    }
    if (prop === 'ref' && val !== undefined) {
      ref = val;
      continue;
    }
    // 处理其他属性
    if (Object.prototype.hasOwnProperty.call(config, prop)) {  // 只处理 config 对象本身的属性
      props[prop] = val;
    }
  }

  const childrenLength = maybeChildren.length;
  if (childrenLength) {
    if (childrenLength === 1) {
      props.children = maybeChildren[0];
    } else if (childrenLength > 1) {
      props.children = Array.from(maybeChildren);
    }
  }

  return ReactElement(type, key, ref, props)
};

export const Fragment = REACT_FRAGMENT_TYPE;

// 开发环境下的 jsx 函数
export const jsxDEV = (type: Type, config: any): ReactElementType => {
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};

  // 遍历 config 对象
  for (const prop in config) {
    const val = config[prop];
    if (prop === 'key' && val !== undefined) {
      key = val;
      continue;
    }
    if (prop === 'ref' && val !== undefined) {
      ref = val;
      continue;
    }
    // 处理其他属性
    if (Object.prototype.hasOwnProperty.call(config, prop)) {  // 只处理 config 对象本身的属性
      props[prop] = val;
    }
  }

  return ReactElement(type, key, ref, props)
};