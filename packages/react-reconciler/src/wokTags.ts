export type WorkTag = 
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText;

export const FunctionComponent = 0;
export const HostRoot = 3;  // 项目挂载的根节点
export const HostComponent = 5;  // 原生组件
export const HostText = 6;  // 文本节点
