---
slug: nextjs-middleware
title: Next.js Middleware 페이지 접근 제어
created_at: 2023-08-20T20:11:20
---

개발을 하면서 로그인 상태 또는 권한에 따라 권한이 없는 사용자가 어떠한 루트로 접근하는 것을 막아야하는 경우가 많습니다. 이를 구현하는 다양한 방법들이 있는데 Vue에서 `vue-router`가 제공하는 Navigation Guard로 이를 구현하거나 React에서 Private Route 컴포넌트를 만들어서 `react-router-dom`의 Route에서 필요한 페이지에 이를 감싸주는 방식을 많이 사용합니다.

제가 진행한 Next.js 프로젝트에서 초기에 구현했던 방식과 Next.js의 Middleware를 사용하여 가독성과 성능을 개선한 사례를 소개해드리겠습니다.

# 초기 접근제어 방식

처음 접근제어를 구현하기위해 저는 `<AuthLayout>` 이라는 컴포넌트를 만들어 제어가 필요한 페이지의 layout에 이를 감싸주는 방식으로 접근제어를 구현하였습니다.

```jsx
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isAuthenticated = getAccessToken();
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [router, pathname]);

  return <>{children}</>;
};

export default AuthLayout;
```

그러나 위와 같은 방식으로 구현했을 때 React와 Next.js의 차이로인해 보다 불편한 점이 있었는데 React에서는 react-router-dom을 사용해서 app.js 파일에서 라우터를 통합 관리하기 때문에 한눈에 어떤 페이지에서 이를 적용하였는지 알 수 있고 필요한 페이지에 이를 적용하거나 제거하기 용이하였습니다.

```jsx
// React 예시

const App = ({ cardRepo }) => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/search"
          element={
            <AuthLayout>
              <Search />
            </AuthLayout>
          }
        />
        <Route
          path="/user"
          element={
            <AuthLayout>
              <User />
            </AuthLayout>
          }
        />
      </Routes>
    </Router>
  );
};
```

그러나 Next.js에서는 폴더 구조를 통해서 라우팅 처리를 자동적으로 처리해주기 때문에 적용할 페이지를 찾아서 layout에 직접 감싸주어야 하고 내가 어떤 페이지에 적용했는지 찾거나 제거하기 위해서는 일일이 확인해야 한다는 단점이 생겼습니다. 이를 해결하기위해 Next.js의 Middleware를 사용하였습니다.

# Next.js Middleware란

공식문서 Middleware 설명을 보면 “Middleware는 요청이 완료되기 전에 코드를 실행할 수 있고 그에 따라 응답을 수정할 수 있습니다. 그런 다음 들어오는 요청에 따라 요청 또는 응답 헤더를 재작성, 리다이렉션, 수정하거나 직접 응답하여 응답을 수정할 수 있습니다. 그리고 Middleware는 캐시된 콘텐츠와 경로가 일치하기 전에 실행됩니다.” 라고 되어있습니다.

이를 간단히 말하면 사용자의 요청을 처리하여 응답을 반환하기 전에 조작하여 응답할 수 있는 것입니다. 즉, Middleware를 사용하여 요청 및 응답을 수정할 수 있고 기본적으로 요청 헤더, 응답 헤더, 쿠키, 경로 등을 수정할 수 있습니다. 이를 활용하여 페이지 접근 제어를 간단하게 구현할 수 있습니다.

> Next.js Middleware는 [Edge Runtime](https://vercel.com/docs/functions/edge-functions/edge-runtime)을 사용하기 때문에 Node.js APIs나 Browser APIs와 같은 API를 사용할 수 없고 Middleware APIs를 사용해야합니다.

# Middleware로 접근 제어 구현

우선 middleware를 사용하기 위해서 middleware.ts를 프로젝트의 루트에 넣어주어야합니다. (ex. src/middleware.ts)  
간단한 사용 예시를 살펴보면 아래와 같이 작성할 수 있습니다. 아래 예시 코드를 그대로 적용하면 이제 /test 경로를 사용자가 이동하였을 때 /home으로 변하여 경로가 바뀌게 됩니다. 가장 아래의 matcher에 해당하는 경로일 경우에만 위 middleware가 실행되는 것입니다.

```jsx
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL("/home", request.url));
}

export const config = {
  matcher: "/test",
};
```

이제 이를 조금만 응용해서 토큰이 있는지 확인하는 코드만 추가하면 바로 접근 제어를 구현할 수 있습니다.

```jsx
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const cookieToken = request.cookies.get("token");
  if (!cookieToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/search", "/user"],
};
```

기존 방식은 useEffect를 통해 CSR 방식으로 사용자의 로그인 상태를 확인하고 페이지를 라우팅하는데 이때 useEffect는 비동기적으로 화면이 렌더링되고 동작하기 때문에 사용자에게 잠시동안 초기 상태의 화면이 보이는 문제가 있습니다.  
그에 반해 Middleware는 사용자에게 요청이 오면 응답 전에 처리를 해서 주기 때문에 요청이 오면 로그인 되었는지 확인을 하고 각 페이지로 가도록 동작하기 때문에 응답 시간을 개선하고 사용자 경험 문제도 해결할 수 있습니다.

# 추가적인 Middleware 사용법

접근 제어 외에도 Next.js의 Middleware로 할 수 있는 것들이 많은데 Geolocation와 A/B Test 등 유용하게 사용할만한 기능들을 제공하고 있습니다. 아래 깃허브에서 다양한 기능들을 구현한 예제 코드들을 확인해볼 수 있습니다.  
[https://github.com/vercel/examples/tree/main/edge-functions](https://github.com/vercel/examples/tree/main/edge-functions)

## Geolocation

Next.js middleware에서 제공하는 NextRequest API의 `geo` 를 통해 지리 정보에 대한 엑세스를 제공합니다. 이를 통해 사용자의 위치를 알 수 있고 사용자의 위치를 기반으로한 콘텐츠를 만들 수도 있습니다.  
(참고로 Vercel에 배포하면 GeoIP에 데이터가 표시되고 로컬 환경에서는 사용자의 위치를 알 방법이 없기 때문에 해당 데이터가 비어있게 됩니다.)

## A/B 테스트

Middleware를 사용한 A/B 테스트는 쿠키를 사용하여 사용자를 특정 버킷에 할당한 다음 서버가 할당된 버킷에 따라 사용자를 A 또는 B 버전으로 리다이렉션 시킵니다. 이전에는 개발자가 정적 사이트의 클라이언트 측에서 A/B 테스트를 수행하여 처리 속도가 느려지고 레이아웃이 변경될 수 있었지만 Next.js Middleware는 사용자 요청의 서버측 처리를 가능하게 하여 프로세스를 더 빠르게하고 레이아웃 변경을 방지합니다.  
<br /><br />
이 외에도 Next.js Middleware로 할 수 있는 흥미로운 방안들이 많고 Middleware 뿐만 아니라 계속해서 다양한 기능들을 제공해주는 Next.js를 잘 이해하고 사용한다면 효과적이고 효율적으로 개발을 할 수 있을 것입니다.
