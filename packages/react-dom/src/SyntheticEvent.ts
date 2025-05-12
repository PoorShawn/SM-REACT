import { Container } from "hostConfig";
import { Props } from "shared/ReactTypes";

type EventCallback = (e: Event) => void;

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

export const elementPropsKey = '__props';
const validEventType = ['click']

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventType.includes(eventType)) {
    console.warn('当前不支持该事件类型：', eventType);
    return;
  }

  if (__DEV__) {
    console.log('初始化事件：', eventType);
  }

  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  })

}

function createSyntheticEvent(e: Event) {
  const SyntheticEvent = e as SyntheticEvent;
  SyntheticEvent.__stopPropagation = false;

  const originStopPropagation = e.stopPropagation;

  SyntheticEvent.stopPropagation = () => {
    SyntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  }

  return SyntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;

  if (targetElement === null) {
    console.warn('事件不存在 target：', e);
  }
  
  // 1. 收集沿途的事件
  const {bubble, capture} =  collectPaths(targetElement as DOMElement, container, eventType);
  // 2. 构造合成事件
  const se = createSyntheticEvent(e);

  // 3. 遍历 capture 捕获事件列表
  triggerEventFlow(capture, se);

  if (!se.__stopPropagation) {
    // 4. 遍历 bubble 冒泡事件列表
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i< paths.length; i++) {
    const callback = paths[i];
    callback.call(null, se);

    if (se.__stopPropagation) {
      break;
    }
  }
}

function getEventCallbackNameFromEventType(eventType: string): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick']
  }[eventType];
}

function collectPaths(targetElement: DOMElement, container: Container, eventType: string) {
  const paths: Paths = {
    capture: [],
    bubble: []
  }

  while (targetElement && targetElement !== container) {
    // 收集
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, index) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (index === 0) {
              // capture
              paths.capture.unshift(eventCallback);
            } else {
              // bubble
              paths.bubble.push(eventCallback);
            }
          }
        })
      }
    }

    targetElement = targetElement.parentNode as DOMElement;
  }

  return paths;
}