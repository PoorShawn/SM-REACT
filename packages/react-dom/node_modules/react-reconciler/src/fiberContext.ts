import { ReactContext } from "shared/ReactTypes";

let preContextValue = null;
const preContextValueStack = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  preContextValueStack.push(preContextValue);

  preContextValue = context._currentValue;
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
  context._currentValue = preContextValue;

  preContextValue = preContextValueStack.pop();
}