import { useState } from 'react';
import ReactDOM from 'react-dom';

function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return num === 3 ? <p>hello</p> : <div>{num}</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
