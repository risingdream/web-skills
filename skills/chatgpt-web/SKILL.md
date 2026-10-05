---
name: chatgpt-web
description: Ask ChatGPT via chatgpt.com UI automation (Ego Lite) and return the answer, no OpenAI API. Use when the user says /chatgpt, asks to consult ChatGPT or a GPT-5 model, attaches a file for ChatGPT, or continues a saved ChatGPT session.ko: ChatGPT 웹 질의가 필요할 때 사용.
---

# chatgpt-web skill

`chatgpt.com`을 Ego Lite (`ego-browser`)로 조작하는 UI 자동화 스킬.
OpenAI API·`backend-api` 직접 호출 없음. DOM 접근성 트리 + `evaluate()`만 사용.

## 백엔드

- `ego/` — Ego Lite 백엔드 (현재 기본값, 검증됨).
- `aside/` — Aside 브라우저 백엔드 (추가 예정).
- `references/`의 셀렉터·마커·엣지케이스는 백엔드 공용.

## 전제

- Ego Lite Space 이름: `chatgpt-web` (최초 검증 시 spaceId 553)
- 로그인 필수. 비로그인이면 `handOff()` 후 사용자가 Ego Lite 앱에서 직접 로그인.
- `ego-browser` API는 v2 기준: `taskSpace(name)`, `task.page("p1")`,
  `page.goto/snapshot/fill/click/waitForURL/waitForFunction/evaluate`.

## 핵심 셀렉터 (2026-10-04 실측, 로그인 상태)

| 용도 | 셀렉터 |
|---|---|
| 새 채팅 | snapshot의 `text "새 채팅"` 버튼 (`@34`였음, ref는 매번 변함) |
| composer | `textfield "ChatGPT에게 물어보세요"` — `page.fill(ref, prompt, { clearFirst: true })` |
| 보내기 | `button "보내기"` — 입력 후에만 나타남 (빈 상태에선 음성 버튼만 있음) |
| 쿠키 거부 | `button "비필수사항 거부"` (다이얼로그 있을 때만) |

## ask 플로우 (검증됨, `ego/tools/ask.js` 그대로 실행)

임베디드 런타임은 부모 env를 상속하지 않음 (실측). 프롬프트는 파일로 전달:

```bash
# 프롬프트를 /tmp/chatgpt-prompt.txt 에 쓰고
ego-browser nodejs < ego/tools/ask.js
# → {"url": "https://chatgpt.com/c/<uuid>", "answer": "..."}
# → URL은 /tmp/chatgpt-url.txt 에도 저장
```

1. `taskSpace("chatgpt-web")` + `task.page("p1")`, URL이 chatgpt.com이 아니면 `goto`
2. 새 채팅 버튼 클릭 (draft 잔류 방지)
3. snapshot에서 composer ref 확인 후
   `await page.fill(composerRef, PROMPT, { clearFirst: true })`
4. snapshot에서 보내기 ref 확인 후 클릭 (입력 후에만 렌더링됨)
5. 실제 대화 URL 대기 — `local-chatgpt%` 중간 URL 제외:
   `waitForFunction(() => /\/c\/(?!local)[0-9a-f-]{8,}/.test(location.href))`
6. 완료 대기 — 마커 + 완료신호 둘 다:
   `waitForFunction(() => innerText.includes("ChatGPT 답변:") && innerText.includes("응답이 완료되었습니다"))`
   후 꼬리 안정화 `waitForTimeout(2500)`
7. 마지막 `ChatGPT 답변:` ~ cut 마커 사이 추출. cut 마커:
   `지금까지 대화가 도움이 되었나요?`, `ChatGPT는 실수할 수 있습니다`,
   `최신 응답`, `응답이 완료되었습니다`
8. `await page.url()` → `sessions.json` + `/tmp/chatgpt-url.txt`에 저장

이어서 질문은 `ego/tools/continue.js` (`/tmp/chatgpt-url.txt` + `/tmp/chatgpt-prompt.txt` 사용).

## CLI (`ego/bin/chatgpt`)

```bash
chatgpt "질문"                                # 새 채팅 (default 세션 갱신)
chatgpt --new "질문"                          # 새 채팅 (명시)
chatgpt --continue "후속 질문"                # default 세션 이어받기
chatgpt --session tax "질문"                  # tax 세션에 새 채팅
chatgpt --session tax --continue "후속"       # tax 세션 이어받기
chatgpt --model "GPT-5.5" "질문"              # 모델 지정 후 새 채팅
chatgpt --file report.pdf "요약해줘"          # 파일 첨부 (반복 가능)
chatgpt --timeout 600 "장문 써줘..."          # 완료 대기 초 단위 (기본 120)
chatgpt --session img --download [dir]        # 저장된 대화의 파일/이미지 내려받기
echo "..." | chatgpt --session tax            # stdin 프롬프트
```

- 프롬프트 전달은 전부 파일(`/tmp/chatgpt-prompt.txt` 등). 임베디드 런타임은
  부모 env를 상속하지 않음 (실측) — `process.env` 사용 금지.
- 세션 URL은 `sessions.json`에 `{이름: url}` 저장. 검증됨: new/continue/attach/model.
- 장시간 생성 검증됨 (8장 가이드북, 217초·1.7만자): 동일 마커로 완료 감지,
  30초 폴링에도 스트리밍 중단 없음. `--timeout`으로 대기 연장 (기본 120초).

## 다운로드 (`ego/tools/download.js`, 검증됨)

- 파일 응답: `button "파일 다운로드"` → `waitForEvent("download")` + `saveAs()`.
  부모 오버레이에 가려 일반 `click()`이 `intercepts pointer events`로 실패하므로
  `evaluate` 직접 클릭 폴백 필수 (첨부 칩 제거 버튼과 동일 패턴).
- 생성 이미지: 이미지 버튼 클릭 후 나타나는 `button "다운로드"` 클릭.
  이미지 답변은 텍스트가 거의 없어(`answer: "편집"` 수준) 텍스트 추출이 무의미 —
  산출물은 파일로 받을 것.
- `chatgpt --session NAME --download [dir]` (기본 `/tmp/chatgpt-downloads`).
  검증: CSV 원본 그대로 + 생성 PNG(1.3MB, 한글 파일명 유지).
- stdout에 JSON 외 잡음이 섞일 수 있어 URL 파싱은 `{...}` 구간만 추출.

## 모델 선택 (`ego/tools/select-model.js`, 검증됨)

- `loc=role:button[name="ChatGPT 모델 선택"]` 클릭 → `menu "추론 수준"`
- `menuitemradio`의 innerText 부분일치로 선택 (실측 옵션: `GPT-5.6 Sol`, `GPT-5.5`)
- 닫기는 `page.keyboard.press("Escape")`. 메뉴 열린 상태의 버튼 표기는
  `추론 수준`, 평상시는 `High` — 검증용으로만 사용, 로직에 의존 금지.
- `text="..."` 셀렉터는 aria-label 전용 버튼(모델 선택, 파일 추가)에 매칭 안 됨.
  반드시 `loc=role:button[name="..."]` 사용.

## 파일 첨부 (검증됨)

- `파일 등 추가` → `사진 및 파일 추가` (visible 텍스트라 `text=` 매칭됨) →
  `waitForFileChooser` 선대기 + `chooser.setFiles([...])` (multiple:true)
- 칩 확인: body에 basename 포함될 때까지 대기.
- 제거 버튼(`"[파일명] 제거"`)은 16px에 부모 오버레이가 겹쳐 `click()`이
  `intercepts pointer events`로 실패. 폴백: `evaluate(() => btn.click())`.
- 답변 추출에 칩 파일명이 섞일 수 있음 (기知 quirks).

## 스냅샷 정규식 주의 (실측 버그 수정됨)

- 버튼 행은 `[ref=727, loc=...]` 형태 (ref 뒤에 `,` + loc). `\[ref=(\d+)\]`
  로 닫는 대괄호를 기대하면 절대 매칭 안 됨. 반드시 `\[ref=(\d+)[,\]]`.
- 보내기 버튼은 입력 후 렌더링까지 시간차가 있어 단일 snapshot이 아닌
  폴링(최대 12회 × 1s)으로 탐색.

## 주의

- `data-message-author-role` / `.markdown` / `article` 셀렉터는 현재 DOM에 없음
  (실측 0건). `innerText` 마커 파싱을 정식으로 사용.
- 빈 composer에는 `보내기` 버튼이 없음. `fill` 후 snapshot 재확인하고 클릭.
- composer에 이전 draft가 남아있을 수 있음. 반드시 `clearFirst: true`.
- 긴 답변은 120초 이상 걸릴 수 있음. `waitForTimeout` 고정 대기 금지,
  `waitForFunction("응답이 완료되었습니다")` 사용.
- 작업이 끝나면 `await task.finish({ keep: [] })`로 스페이스를 닫을 것.
  로그인은 프로필 쿠키에 유지되므로 다음 실행 시 자동 복원되고,
  대화 URL은 `sessions.json`에 있으므로 이어쓰기도 가능.
  잔해 스페이스를 남기지 말 것 (에러·handOff로 중단된 경우는 제외).
- `ego/tools/ask.js`가 위 플로우의 복사-실행용 완성본. `references/selectors.md`에 상세 기록.
