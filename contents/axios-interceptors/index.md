---
slug: axios-interceptors
title: Axios Interceptors를 이용한 토큰 처리
created_at: 2023-08-21T19:16:26
---

Axios를 사용하여 API와 통신할 때, 토큰 기반 인증을 사용하는 경우가 많습니다. 이러한 경우, 항상 헤더에 인증 토큰을 포함시켜야 합니다. 그리고 토큰이 만료되었을 때 refresh token으로 새로운 토큰을 발급받아 API를 다시 요청해야하는데 Axios Interceptor를 사용하여 이를 간단하게 처리할 수 있습니다.

# 로직 순서

구현에 앞서 어떤 순서로 interceptor 내부 동작을 구현해야할 지 정리해보겠습니다.

1. 토큰이 필요한 API, 토큰이 필요없는 API 구분  
   우선 로그인한 사용자만 사용할 수 있는 API와 모든 사용자(비로그인 사용자)가 사용하는 API를 구분합니다.  
   후자의 경우 그냥 일반적인 axios instance를 생성하는 것과 같습니다.
2. API 요청 시 토큰을 헤더에 담기  
   API 요청을 Interceptor로 가로채서 요청이 전달되기 전에 instance header에 토큰을 담아서 보내줍니다.
3. 토큰 만료시 refresh token으로 토큰 재발급, 재발급받은 토큰으로 API 재요청  
   API 호출 시 401 에러(인증 에러)를 받았을 때, 마찬가지로 interceptor로 응답을 가로채서 refresh token을 사용하여 토큰을 재발급 받습니다. 그리고 재발급된 토큰을 헤더에 넣어서 다시 해당 API를 호출합니다.

# 코드 구현

토큰이 필요하거나 필요없는 API에 따라 다른 아래와 같이 토큰없이 보내는 `instance`, 토큰과 함께 보내는 `intanceWithToken`을 만들어서 상황에따라 맞는 인스턴스를 사용하여 API를 호출하도록 할 것입니다.

```jsx
instance.get(url[, config]);
instanceWithToken.get(url[, config]);
```

두 인스턴스를 각각 만들어 export 해주겠습니다. `axios.create` 를 사용해서 baseURL, headers 등 원하는 설정을 넣어주고 withToken에는 setInterceptors로 감싸서 반환해줍니다.

```jsx
// index.ts
import axios from "axios";
import { setInterceptors } from "./interceptors";

const createInstance = () => {
  return axios.create({
    baseURL: "https://base-url.com",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

const createInstanceWithToken = () => {
  const instance = axios.create({
    baseURL: "https://base-url.com",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  return setInterceptors(instance);
};

export const instance = createInstance();
export const instanceWithToken = createInstanceWithToken();
```

먼저 인스턴스를 받아서 해당 인스턴스의 요청과 응답을 가로채서 토큰을 넣고 재발급을 받는 등 작업을 수행하는 `setInterceptors` 함수를 만들 것입니다. 먼저 요청을 가로채서 헤더에 토큰을 넣는 `interceptors.request` 를 먼저 작성해보겠습니다.

```jsx
// interceptors.ts
import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from "axios";

export const setInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem("accessToken");

      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }

      return config;
    },
    (error: AxiosError | Error) => {
      return Promise.reject(error);
    }
  );

  return instance;
};
```

코드를 순서대로 보시면 어떤 식으로 동작하는지 쉽게 확인할 수 있습니다. instance를 받아서 interceptors.request.use로 요청을 가로챈 뒤에 토큰을 가져와서 토큰이 있다면 config.headers로 직접 헤더에 토큰을 넣은 뒤에 config를 반환합니다. 그리고 추가적으로 에러를 처리하는 코드를 마지막에 넣었습니다.

이제 위의 `instanceWithToken` 으로 API를 호출할 때 토큰이 있으면 헤더에 토큰을 넣어서 보내게 됩니다.  
(저는 추가적으로 타입스크립트를 사용했기 때문에 axios에 내장되어있는 타입을 가져와서 지정해주었습니다.)

다음으로 응답을 가로채서 토큰이 만료되었을 때 refresh token을 가져와서 새로운 토큰을 발급받고 이를 헤더에 넣어서 재요청하는 코드를 작성하겠습니다.

```javascript
export const setInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      if (response.data.code === 401) {
        if (response.data.errorMsg === "expired token") {
          const refreshToken = getRefreshToken();
          return instance
            .post("/api/members/reissue", {
              refreshToken: `Bearer ${refreshToken}`,
            })
            .then((refreshResponse) => {
              const newAccessToken = refreshResponse.data.accessToken;
              const newRefreshToken = refreshResponse.data.refreshToken;
              setAccessToken(newAccessToken);
              setRefreshToken(newRefreshToken);
              response.config.headers.Authorization = `Bearer ${newAccessToken}`;
              return instance(response.config);
            })
            .catch((refreshError) => {
              const formattedError = {
                message: "Refresh Token renewal failed",
                originalError: refreshError,
              };
              return Promise.reject(formattedError);
            });
        } else {
					localStorage.removeItem("accessToken");
				  localStorage.removeItem("refreshToken");
          window.location.reload();
        }
      }
      return response;
    },
    (error: AxiosError | Error) => {
      if (axios.isAxiosError(error)) {
        const { status } = error.response as AxiosResponse;
        if (status === 500) return Promise.reject(error);
      }
    },
  );

  return instance;
};
```

제 경우에는 api에서 토큰이 없을 경우에 error로 내려오지 않고 response.code: 401로 내려오도록 되어있기 때문에 response에서 refresh 작업을 처리했습니다. 만약 errer: 401로 내려온다면 코드 하단에 에러 처리 부분에서 `if(error.response.status === 401)` 와 같이 if문으로 처리하면 됩니다.

코드를 순차적으로 살펴보면 먼저 리프레시 토큰이 있을때 그 토큰을 재발급 받는 api를 통해서 새로운 access, refresh 토큰을 받아옵니다. 받아온 토큰을 다시 로컬스토리지에 저장하고`response.config.headers.Authorization` 로 인스턴스 헤더에 다시 토큰을 넣어서 인스턴스를 반환하면 다시 api를 호출하게 됩니다. 즉, `instance(response.config);` 에서 새로운 설정을 원래의 요청으로 다시 보내는 것입니다. 그 과정에서 에러가 발생했을 때 `.catch`로 에러를 처리하고 만약 401인데 토큰이 만료된 것이 아닐 경우에 로컬스토리지의 토큰을 모두 지우고 화면을 리로드합니다.

이 외의 에러는 `instance.interceptors.response.use` 의 두번째 인자로 `(error)=>{}` 함수 내에서 처리합니다.

구현을 완료했습니다. 이제 instanceWithToken을 필요한 곳에 사용할 수 있습니다. 간 한예시실로 yscn/cwit으t아로 래처럼 사용할 수 있습니다.

```javascript
const getData = async (id) => {
  try {
    const res = await instanceWithToken.get(`/data/${id}`);
    return res.data;
  } catch (err) {
    return Promise.reject(err);
  }
};
```

Axios의 Interceptors를 사용해서 토큰을 처리하는 코드를 작성해보았습니다. 이 외에도 다른 방식으로 토큰을 관리할 수도 있고 Interceptors로 토큰이 아닌 다른 처리를 할 수도 있습니다. 만약 아직 사용해보지 않았다면 API 요청과 응답을 interceptors를 통해서 깔끔하고 효과적으로 관리해보시면 좋을 것 같습니다.
