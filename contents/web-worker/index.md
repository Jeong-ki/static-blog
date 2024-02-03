---
slug: web-worker
title: Web Worker 멀티 스레드로 성능 개선하기
created_at: 2023-07-21T22:51:10
---

# Web Worker (Web APIs)

Web Worker는 브라우저의 메인 스레드와는 별개로 동작하며 백그라운드 스레드에서 실행되기 때문에 유저 인터페이스를 방해하지 않고 작업을 수행할 수 있습니다.

자바스크립트는 싱글 스레드로 동작하기 때문에 한 번에 하나의 작업만 수행이 가능합니다. 비동기 작업을 통해 자연스럽게 화면 동작이 가능하지만 비동기는 작업의 우선 순위를 뒤로 미루는 것이지 병렬로 실행되는 것이 아닙니다. 브라우저의 이벤트 루프 동작을 이해하시면 이를 알 수 있습니다.

우리가 직접 작성한 코드는 모두 메인 스레드에서 처리됩니다. 파일 시스템이나 Network 통신과 같은 Web API의 일부 함수는 멀티 스레드로 처리가 되는 것도 있지만 그 외의 로직은 비동기라 하더라도 시간이 오래 소요되게 됩니다. 그렇기 때문에 데이터 처리가 많아질수록 병목현상이 생겨 UI 업데이트가 지연되고 사용자에게 느리게 느껴지게 됩니다. 이를 해결하기 위해 브라우저에서 Web Worker API를 제공하고 있습니다.

# Web Worker 사용방법

Web Worker는 필요한 개수만큼 생성할 수 있고 스레드를 만들어 사용하는 것과 같습니다. 메인 스레드와 Web Worker는 메시지 방식으로 서로 통신하며 데이터를 주고받습니다.

Web Worker의 사용법을 살펴보겠습니다. 우선 Worker() 생성자를 호출하여 워커 스레드에서 실행할 스크립트의 경로를 지정하면 됩니다. 그리고 postMessage() 메서드와 onmessage 이벤트 핸들러를 통해 워커에게 메시지를 보낼 수 있습니다.

```jsx
// main.js
const worker = new Worker("myWorker.js");

firstInput.onChange = () => {
  worker.postMessage([firstInput.value, secondInput.value]);
};
secondInput.onChange = () => {
  worker.postMessage([firstInput.value, secondInput.value]);
};
```

위의 main.js에서는 두개의 `input` 요소에 `onChange`이벤트를 걸어서 두 `input` 중 하나의 값이 변경되면 `postMessage` 를 사용하여 두 요소의 값을 워커에게 보냅니다.

```jsx
// myWorker.js
onmessage = (e) => {
  const workerResult = e.data[0] + e.data[1];
  poseMessage(workerResult);
};
```

`onmessage` 핸들러를 사용하면 메시지가 수신될 때마다 코드를 실행할 수 있으며, 메시지 자체는 메시지 이벤트의 data 속성에서 사용할 수 있습니다. 위 예시에서는 받은 두 값을 더해서 `poseMessage`로 결괏값을 다시 메인 스레드에게 보냅니다.

```jsx
// main.js
worker.onmessage = (e) => {
  // e.data 사용
  console.log(e.data);
};

worker.terminate();
```

받은 결괏값을 메인에서 이런 식으로 받아와서 사용할 수 있습니다. 그리고 워커를 즉시 종료해야하는 경우 `terminate` 메서드를 호출하여 워커 스레드를 즉시 종료시킬 수 있습니다.

# 백그라운드에서 계산(데이터 처리) 수행하기

이제 실제로 Web Worker를 사용해서 로직을 수행하는 코드를 작성해보겠습니다. 저는 리액트를 사용해서 몇가지 계산을 수행하는 Web Worker를 구현해봤습니다.

> 참고로 webpack4버전에서는 Web Worker를 사용하기위해 `worker-loader` 를 설치해서 사용해야했는데 webpack 5부터는 설치없이 Web Worker를 사용할 수 있습니다.
>
> ```jsx
> new Worker(new URL("./worker.js", import.meta.url));
> ```

## Web Worker 스레드 기능 구현

```jsx
// worker.ts
const calculateFunctions = {
  getDifference(firstNum: number, secondNum: number) {
    postMessage({
      queryMethodListener: "difference",
      queryMethodArguments: [firstNum - secondNum],
    });
  },

  getMultiple(firstNum: number, secondNum: number) {
    postMessage({
      queryMethodListener: "multiple",
      queryMethodArguments: [firstNum * secondNum],
    });
  },

  getFibonacci(firstNum: number, secondNum: number) {
    function fibonacci(n: number) {
      if (n <= 0) return 0;
      if (n === 1) return 1;
      return fibonacci(n - 1) + fibonacci(n - 2);
    }
    postMessage({
      queryMethodListener: "fibonacci",
      queryMethodArguments: [fibonacci(firstNum), fibonacci(secondNum)],
    });
  },
};

onmessage = (event) => {
  const { queryMethod, queryMethodArguments } = event.data;
  if (queryMethod in calculateFunctions) {
    calculateFunctions[queryMethod](...queryMethodArguments);
  } else {
    postMessage({ error: "Unknown queryMethod" });
  }
};
```

우선 `calculateFunctions` 객체 내부에 각각 두 수의 차, 두 수의 곱 그리고 두 수의 피보나치 값을 계산해서 다시 메인 스레드로 보내주는 함수들을 만들었습니다. postMessage로 보낸 객체를 메인 스레드에서 받아서 결괏값을 화면에 보여주도록 할 것입니다.

그리고 `onmessage` 핸들러를 만들어서 메시지를 수신하고 정의되어있는 queryMethod를 올바르게 받았을 때 해당하는 계산 함수를 실행하고 아니면 에러 메시지를 보내도록 설정하였습니다.

## 메인 스레드에서 Web Worker Instance 생성 및 실행

```jsx
// WorkerComponent.tsx
function WorkerComponent() {
	...

  // 웹 워커 생성
  const worker = new Worker(new URL('./worker.ts', import.meta.url));

	// 워커 스레드에서 받아온 값으로 보여줄 데이터 객체
  const queryMethods: QueryMethods =  {
    difference: (args) => `Difference: ${args[0]}`,
    multiple: (args) => `Multiple: ${args[0]}`,
    fibonacci: (args) => `First Fibonacci: ${args[0]}, Second Fibonacci: ${args[1]}`,
  }

  useEffect(() => {
    // 웹 워커 메시지 수신 이벤트 핸들러
    worker.onmessage = (event) => {
      const { queryMethodListener, queryMethodArguments } = event.data as EventData;

      const result = queryMethods[queryMethodListener](queryMethodArguments) || "Invalid query method";
      setResult(result);
    };

    // 컴포넌트 언마운트 시 웹 워커 제거
    return () => {
      worker.terminate();
    };
  }, [worker]);

	// 워커에게 값을 보내는 이벤트 함수
  const handleGetDifference = () => {
    worker.postMessage({
      queryMethod: 'getDifference',
      queryMethodArguments: [inputNumObj.first, inputNumObj.second],
    });
  };

  const handleGetMultiple = () => {
    worker.postMessage({
      queryMethod: 'getMultiple',
      queryMethodArguments: [inputNumObj.first, inputNumObj.second],
    });
  };

  const handleGetFibonacci = () => {
    worker.postMessage({
      queryMethod: 'getFibonacci',
      queryMethodArguments: [inputNumObj.first, inputNumObj.second],
    });
  };

	...
}

export default WorkerComponent;
```

Web Worker 스레드에게 이벤트를 보내고 처리된 값을 받아와서 화면에 보여주는 컴포넌트를 구현했습니다.

`new Worker()` 로 워커 인스턴스를 생성하고 컴포넌트가 마운트될 때 메시지를 수신하는 핸들러를 만들고 언마운트 시 웹 워커를 제거하도록 `useEffect` 내부에서 작업을 해두었습니다.

마지막으로 버튼을 눌렀을 때 워커에게 계산을 수행할 값과 함께 메시지를 보내기 위한 이벤트 핸들러 함수를 만들었습니다.

> 만약 싱글 코어 컴퓨터인 경우 Web Worker를 사용한다 해도 거의 의미가 없어집니다. 이를 최적으로 사용하기 위해서는 CPU의 코어 수 만큼 Web Worker를 만들어서 사용하는 것이 가장 좋습니다.
>
> `navigator.hardwareConcurrency` 를 사용하면 사용자 컴퓨터에서 스레드를 실행하는 데 사용할 수 있는 논리적 프로세서 수를 반환합니다. 즉, 컴퓨터의 CPU 코어의 수를 알 수 있습니다. 이를 활용해 코어의 수만큼 worker를 만들어 사용하는 코드도 만들어볼 수 있습니다.

# Web Worker의 장단점

설명만 보면 정말 좋은 기능이고 꼭 써야할 것 같지만 실제로 많이 사용되고 있지는 않습니다.

그 이유로는 우선 대부분의 웹에서 워커를 쓸 정도로 복잡한 작업을 하지 않기도 하고 DOM 제어 및 Window 객체의 일부 함수에 제약이 있기 때문입니다. 그리고 메인 스레드와 Web Worker간 데이터 전송에도 비용이 발생하기 때문에 위에서 만든 단순 계산하는 워커는 오히려 더 느리게 동작할 수도 있습니다.

반면에 파일 핸들링이나 복잡한 계산이 필요한 경우, 백그라운드에서 지속적인 작업이 필요하거나 메인 스레드에 영향을 미치지 않고 작업을 하는 경우에 유용하게 사용할 수 있습니다. 이 외에도 빅 데이터 처리나 웹 게임 같은 분야에서 Web Worker를 사용할 수 있습니다.
