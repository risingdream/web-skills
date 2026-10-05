---
name: arxiv-search-web
description: Search arXiv papers via the official export API and return metadata as JSON. Use when the user says /arxiv, needs paper search, abstracts, authors, or PDF links.ko: arXiv 논문 검색이 필요할 때 사용.
---

# arxiv-search-web skill

arXiv 검색을 웹(`arxiv.org/search/` HTML 파싱, 기본값)과
공식 export API(폴백)로 수행해 메타데이터를 JSON으로 반환.
브라우저 불필요.

## 백엔드

- `api/` — 웹 검색 기본 + 공식 API 폴백 (검증됨).
- `aside/` — Aside 브라우저 백엔드 (추가 예정, abs 페이지용).

## 사용 (`api/bin/arxiv`)

```bash
arxiv "질의"                    # 상위 10건 (관련도순)
arxiv --max 5 --sort new "질의" # 개수·정렬(new|relevance) 지정
arxiv --pdf 2601.12345 [dir]    # PDF 다운로드
```

## 출력

`[{id, title, authors[], summary, published, url, pdf}]`.
초록은 2000자로 절단. 카테고리 필터는 `--cat cs.CL` (향후).

## 실측 메모 (2026-10-05)

- export API는 IP당 레이트리밋이 공격적이라 웹 검색을 기본값으로 사용.
  웹 실패 시에만 API로 폴백.
- PDF 다운로드는 스로틀 없음 (실측 2.2MB).
