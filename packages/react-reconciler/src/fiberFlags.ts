export type Flags = number;

export const NoFlags = 0b0000000; // 没有任何标记
export const Placement = 0b0000001; // 插入
export const Update = 0b0000010; // 更新
export const ChildDeletion = 0b0000100; // 删除子节点
export const PassiveEffect= 0b0001000;  // 本次更新副作用
export const Ref = 0b0010000;

export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Ref;
export const PassiveMask = PassiveEffect | ChildDeletion;