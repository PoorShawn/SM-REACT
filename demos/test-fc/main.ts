const button = document.querySelector('button');

interface Work {
  count: number;
}

const workList: Work[] = [];

button && (button.onclick = () => {
  workList.unshift({
    count: 100
  })
});