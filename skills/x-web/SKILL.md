---
name: x-web
description: Read X/Twitter via Ego Lite browser automation and return tweets as JSON. Use when the user says /x, needs X search results, a tweet thread, replies, or post metrics.ko: X(트위터) 검색·스레드 조회가 필요할 때 사용.
---

# x-web skill

`x.com`을 Ego Lite (`ego-browser`)로 조작해 트윗 검색 결과·스레드를
JSON으로 반환. API 키 불필요, 로그인 세션 재사용.

## 전제

- Ego Lite Space 이름: `x-web`. 최초 1회 로그인 필요
  (비로그인 시 검색이 온보딩으로 리다이렉트 → `handOff()` 후 사용자 로그인).
- 작업 종료 시 `task.finish({ keep: [] })`.

## 사용 (`ego/bin/x`)

```bash
x "질의"                 # 실시간 검색 상위 20건
x --max 5 "질의"         # 개수 지정
x --tab top "질의"       # 인기 탭
x --thread URL           # 본문 + 답글
```

## 플로우 (검증됨)

- 검색: `goto https://x.com/search?q=...&src=typed_query&f=live`
- 셀렉터: `article[data-testid="tweet"]` →
  `[data-testid="User-Name"]` / `[data-testid="tweetText"]` / `time[datetime]` /
  상태 링크 `a[href*="/status/"]` / 지표 `[role="group"][aria-label]`
  ("N 답글, N 마음에 들어요, N 조회수" 파싱)
- 스레드: `goto <status URL>` → 첫 article이 본문, 이후가 답글.
- 입력은 파일 (`/tmp/x-query.txt`, `/tmp/x-max.txt`, `/tmp/x-url.txt`).
  임베디드 런타임은 부모 env 미상속.

## 주의

- 레이트리밋 시 빈 timeline 반환. 대기 후 재시도, 무한 재시도 금지.
- `references/selectors.md`에 상세 기록.
