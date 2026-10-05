# chatgpt.com 셀렉터 실측 기록 (2026-10-04, ego-browser v2, 로그인: Jason Jung Plus)

## 비로그인 상태

- `?noauth_recent_chat_failed=1` 파라미터, "로그인해 저장된 채팅에..." 문구
- composer: `textbox "ChatGPT와 채팅"` (`css:textarea[name="prompt"]`)
- 보내기: `button "메시지 보내기"`
- 쿠키 다이얼로그: `role=dialog[name="저희는 쿠키를 사용합니다"]`,
  거부 버튼 `text "비필수사항 거부"` 클릭으로 제거 확인

## 로그인 상태 (실측 snapshot 발췌)

- composer: `textfield "ChatGPT에게 물어보세요"` + 내부 `paragraph`(draft 텍스트)
- 보내기: `button "보내기"` (`aria-label="보내기"`)
  - 빈 composer에서는 보내기가 없고 `음성 입력` / `음성 대화 시작`만 있음
- 모델: `button "ChatGPT 모델 선택"` (표시 텍스트 `High`)
- 새 채팅: `button` + `text "새 채팅"` (사이드바 상단)
- 대화 URL: 전송 후 `https://chatgpt.com/c/<uuid>`로 이동
  - 중간에 `https://chatgpt.com/c/local-chatgpt%3A<uuid>`를 거침
  - 검증된 실측 URL: `/c/6ac2c4c4-1900-83ee-8e33-8e10845b05fe`

## 답변 DOM (검증된 테스트: "1+1은? 숫자로만 답해줘" → "2")

- `data-message-author-role`: 0건
- `.markdown`: 0건
- `article`: 0건
- leaf 텍스트 순서:
  `내가 한 말:` → 유저 텍스트 → `ChatGPT 답변:` → 답변 → 면책문구 → `최신 응답`
- 완료 신호: body tail에 `응답이 완료되었습니다`
- 스트리밍 중에는 정지 버튼이 있으나 완료 후 사라짐

## compose 안정 셀렉터 우선순위

1. snapshot ref (`@N`) — 매 라운드 새로 취득
2. `loc=role:textbox[name*="ChatGPT"]` 계열 (role명은 스냅샷 표기에 따라 textfield/textbox 변동)
3. `text="ChatGPT에게 물어보세요"` 래퍼에서 후손 탐색 (최후 수단, `evaluate` 사용)

## fill 검증

- `await page.fill("@91", "...", { clearFirst: true })` 로 기존 draft(URL) 덮어쓰기 성공
- `clearFirst` 없이 실행하지 말 것 (이전 draft 잔류 실측됨)

## 모델 메뉴 (대화 페이지, 로그인 상태)

- `button "ChatGPT 모델 선택"` (평상시 표시 `High`) 클릭 →
  `menu "추론 수준추론 수준"`:
  - `menuitem "모델 선택"` (text `High`, 부기: 사용 가능량을 더 빨리 소모)
  - `menuitem "파워"` + `slider`
  - `menuitemradio "GPT-5.6 Sol"`
  - `menuitemradio "GPT-5.5"` (부기: Leaving on October 14)
- 선택: radio innerText 부분일치 클릭. 메뉴 열린 동안 버튼 표기는 `추론 수준`으로 바뀜.

## 파일 첨부 메뉴 (`button "파일 등 추가"` 클릭 시, container)

- 추가: `사진 및 파일 추가`(컴퓨터에서 업로드) / `Add from library` / `심층 리서치`
- 플러그인: 이미지 생성 / 웹 검색 / 스케치 / GitHub / Task Tool / Vercel
- 업로드 후 composer에 칩: `text "[파일명]"` + `button "[파일명] 제거"` (16×16,
  부모 오버레이와 겹쳐 일반 click 실패 → evaluate 직접 클릭)
- 파일 있으면 빈 composer에도 `보내기` 버튼이 나타남 (텍스트 없이 전송 가능)

## 추출 cut 마커 (마지막 `ChatGPT 답변:` 이후, 먼저 나오는 것에서 절단)

`지금까지 대화가 도움이 되었나요?` / `이 성격이 마음에 드시나요?` /
`ChatGPT는 실수할 수 있습니다` / `최신 응답` / `응답이 완료되었습니다`
