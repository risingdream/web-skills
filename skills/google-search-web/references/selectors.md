# google.com 셀렉터 실측 기록 (2026-10-05, ego-browser v2)

## 진입

- 직접 URL: `https://www.google.com/search?q=...&num=N&hl=ko`
  (검색창 타이핑·서제스트 회피)
- 동의 페이지가 뜨면 버튼 텍스트 `동의` 클릭 (한국 로케일 실측)

## 결과 구조 (구 `div.g` 소멸 확인)

- `div#search` 존재. `div.g` 0건.
- `div#search h3` رو 순회:
  - URL = `h.closest('a')?.href`
    → 없으면 `h.parentElement.parentElement.querySelector('a[href^="http"]')`
  - 둘 다 없으면 스킵, URL 중복 제거
  - 스니펫 = 포함 블록 텍스트에서 제목 제거 후 300자
- AI 오버뷰·사이트링크 h3도 섞여 들어옴. 스니펫이 부모 블록 텍스트라
  노이즈 포함 가능 (v1 한계).
- `num` 파라미터는 무시되는 경우 있음 (AI 모드 레이아웃).
