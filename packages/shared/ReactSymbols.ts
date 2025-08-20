const supportSymbol = typeof Symbol === 'function' && Symbol.for;

// React元素的类型
export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for('react.element')
  : 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
  ? Symbol.for('react.fragment')
  : 0xeacb;

export const REACT_CONTEXT_TYPE = supportSymbol
  ? Symbol.for('react.context')
  : 0xeacc;

export const REACT_PROVIDER_TYPE = supportSymbol
  ? Symbol.for('react.provider')
  : 0xeac2;