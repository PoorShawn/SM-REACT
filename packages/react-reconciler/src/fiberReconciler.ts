import { Container } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { HostRoot } from "./wokTags";
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from "./updateQueue";
import { ReactElementType } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { requestUpdateLane } from "./fiberLanes";


export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);

  hostRootFiber.updateQueue = createUpdateQueue();

  return root;
}

export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {
  const hostRootFiber = root.current;
  const lane = requestUpdateLane();  // 获取默认的优先级
  const update = createUpdate<ReactElementType | null>(element, lane);

  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );

  scheduleUpdateOnFiber(hostRootFiber, lane);

  return element;
}