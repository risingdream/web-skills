# x.com 셀렉터 실측 기록 (2026-10-05, ego-browser v2, 로그인 상태)

## 진입

- 실시간 검색: `https://x.com/search?q=...&src=typed_query&f=live`
- 인기: `f=top`. 비로그인 시 `/i/jf/onboarding` 리다이렉트 → 로그인 필요.
- lazy-load: 스크롤당 추가 로드. 1500px씩 최대 10회.

## 트윗

- 컨테이너: `article[data-testid="tweet"]`
- 작성자: `[data-testid="User-Name"]` (개행 공백화)
- 본문: `[data-testid="tweetText"]`
- 시각: `time[datetime]` (ISO)
- 고유링크: `a[href*="/status/"]`
- 지표: `[role="group"][aria-label]` ("1 답글, 2 마음에 들어요, 99 조회수")

## 스레드

- status URL 진입 시 첫 article = 본문, 이후 = 답글 (상위 10개).
