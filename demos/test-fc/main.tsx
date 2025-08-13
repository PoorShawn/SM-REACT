import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function App() {
  const [num, updateNum] = useState(0);
  useEffect(() => {
    console.log('App mount');
  }, []);

  useEffect(() => {
    console.log('num change create: ', num);
    return () => {
      console.log('num change destroy: ', num);
    }
  }, [num])

  return (
    <div onClick={() => updateNum(num => num + 1)}>
      { num === 0 ? <Child/> : 'noop' }
    </div>
  )
}

function Child() {
  useEffect(() => {
    console.log('Child mount');
    return () => console.log('Child unmount');
  }, []);

  return 'I am a Child';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
