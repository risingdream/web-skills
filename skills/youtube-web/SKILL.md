---
name: youtube-web
description: Read YouTube via Ego Lite browser automation and return video metadata, description, chapters, and search results as JSON. Transcript extraction is currently blocked (see SKILL.md). Use when the user says /yt, needs YouTube video info or research.ko: 유튜브 영상 정보·리서치가 필요할 때 사용.
---

# youtube-web skill

`youtube.com`을 Ego Lite (`ego-browser`)로 조작해 영상 메타데이터·설명·챕터·검색
결과를 JSON으로 반환.

## 전제

- Ego Lite Space 이름: `youtube-web`. YouTube 로그인済 (Premium 계정 확인).
- 작업 종료 시 `task.finish({ keep: [] })`.

## 사용 (`ego/bin/yt`)

```bash
yt --meta URL             # 제목·채널·조회수·설명·챕터
yt "질의"                 # 동영상 검색 상위 10건
yt --transcript URL [--lang ko]  # 자막 JSON (아래 참조)
```

## 자막 (`ego/tools/transcript.js`, 검증됨)

브라우저 경로는 막혔으므로(아래 블로커) `yt-dlp`로 우회:

- `yt-dlp --js-runtimes node --write-auto-subs --write-subs` (node 필수.
  없으면 JS 챌린지를 못 풀어 자막 0건).
- 429 시 45초·90초 백오프 후 재시도 (최대 3회). 수동·자동 무관하게 동작 확인
  (TED en 수동 159cue, JSConf ko 자동 253cue).
- 출력: `{videoId, lang, file, cues:[{start,dur,text}], text}`.
- 한계: 대량 연속 추출은 IP 레이트리밋. 외부 도구 의존(yt-dlp + node).

## 자막 블로커 (2026-10-05 실측, 해결되면 갱신)

- `timedtext` 직접 호출: 200 OK + 본문 0바이트 (수동/자동 무관).
  BotGuard `pot` 토큰 요구로 추정.
- UI 패널: `스크립트` 탭 선택까지 되나 `get_transcript`가
  `400 FAILED_PRECONDITION` 반환 (CDP `getResponseBody`로 확인.
  YouTube 자체 프론트 요청도 실패하므로 셀렉터 문제가 아님).
- 같은 패널의 챕터(`YTD-MACRO-MARKERS-*`)는 정상 렌더링.
- 확인된 플로우(자막 해제 후 재사용):
  `...더보기` → `스크립트 표시`(가시 버튼 좌표 클릭) →
  동영상 정보 패널 `스크립트` 탭.

## 주의

- 입력은 파일 (`/tmp/yt-url.txt`, `/tmp/yt-query.txt`). env 미상속.
- `references/selectors.md`에 상세 기록.
