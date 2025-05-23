const supportSymbol = typeof Symbol === 'function' && Symbol.for;

// React元素的类型
export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for('react.element')
  : 0xeac7;