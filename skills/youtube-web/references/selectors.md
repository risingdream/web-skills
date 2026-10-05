# youtube.com 셀렉터 실측 기록 (2026-10-05, ego-browser v2, 로그인 상태)

## 진입

- 시청: `https://www.youtube.com/watch?v=...`
- 검색: `https://www.youtube.com/results?search_query=...`
- 스냅샷은 뷰포트 범위. 우측 패널은 스크롤 후에도 a11y에 안 잡힐 때 있음.

## 메타데이터

- 제목: `h1.ytd-watch-metadata yt-formatted-string`
- 채널: `ytd-channel-name a`
- 설명: `ytd-text-inline-expander` (펼치기 전에도 전문 있음)
- 설명 펼치기: `text="...더보기"` 클릭

## 동영상 정보 패널 (설명 펼친 뒤)

- `ytd-engagement-panel-section-list-renderer` (초기 높이 0, 활성화 후 표시)
- 탭: `[role="tab"]` (챕터/스크립트). a11y 미노출 시 좌표 클릭 폴백.
- 설명 내 인라인 섹션: `ytd-video-description-transcript-section-renderer`
  (`스크립트 표시` 버튼 2개, 가시한 것만 클릭)
- 챕터: `ytd-macro-markers-list-item-renderer` (정상 동작 확인)

## 자막 블로커 상세

- `timedtext` 계열 전부 200-empty (수동/자동, `video.google.com` 포함).
- `ytInitialData.engagementPanels[].continuationItemRenderer.continuationEndpoint.getTranscriptEndpoint.params`
  로 직접 POST → 400 FAILED_PRECONDITION (API 키 포함해도 동일).
- UI 경로의 `get_transcript`도 CDP 응답 본문 기준 동일 400.
- `poToken`은 `ytInitialPlayerResponse.serviceIntegrityDimensions`에 없음.

## X가 아니라 유튜브 검색 결과

- `ytd-video-renderer` → `#video-title`(제목+href), `ytd-channel-name a`,
  `#metadata-line`(조회수·시기), `ytd-thumbnail-overlay-time-status-renderer`(길이)
