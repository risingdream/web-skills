---
name: google-search-web
description: Search Google via Ego Lite browser automation and return organic results as JSON. Use when the user says /gsearch, needs fresh web search results, links, or snippets beyond the built-in web search.ko: 구글 검색 결과가 필요할 때 사용.
---

# google-search skill

`google.com` 검색을 Ego Lite (`ego-browser`)로 자동화하고 상위 오가닉
결과 `{title, url, snippet}` 배열을 JSON으로 반환.

## 백엔드

- `ego/` — Ego Lite 백엔드 (현재 기본값, 검증됨).
- `aside/` — Aside 브라우저 백엔드 (추가 예정).
- `references/`의 셀렉터·엣지케이스는 백엔드 공용.

## 사용 (`ego/bin/gsearch`)

```bash
gsearch "질의"              # 상위 10건
gsearch --max 5 "질의"      # 개수 지정
```

## 플로우 (`ego/tools/search.js`, v2 API)

1. `taskSpace("google-search")` + `page.goto("https://www.google.com/search?q=...&num=...&hl=ko")`
   - 직접 URL 진입 (검색창 타이핑·서제스트 회피)
   - 동의 페이지 나오면 `동의`/`Accept all` 버튼 클릭 후 재시도
2. `waitForSelector("div#search")` 후 `evaluate`로 `div.g` 파싱
   (`h3` 제목, `a` href, 스니펫)
3. `task.finish({ keep: [] })`로 스페이스 닫기

## 주의

- 임베디드 런타임은 부모 env 미상속 — 입력은 파일
  (`/tmp/gsearch-query.txt`, `/tmp/gsearch-max.txt`).
- `div.g` 구조가 바뀌면 `references/selectors.md` 갱신 후 추출부 수정.
- 연속 대량 검색은 레이트리밋·캡차 가능. 429/캡차 시 중단하고 보고.
