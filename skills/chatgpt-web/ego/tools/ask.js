// chatgpt-web ask — 새 채팅에서 1회 질문하고 답변 + URL 출력.
// 프롬프트 전달: PROMPT_FILE 경로의 텍스트를 읽음 (임베디드 런타임이 부모 env를
// 상속하지 않으므로 process.env 사용 금지 — 실측 확인).
// 사용:
//   (프롬프트를 PROMPT_FILE에 쓰고) ego-browser nodejs < ego/tools/ask.js
//   기본 PROMPT_FILE=/tmp/chatgpt-prompt.txt, URL_OUT=/tmp/chatgpt-url.txt

const fs = await import("node:fs/promises");
const PROMPT_FILE = "/tmp/chatgpt-prompt.txt";
const URL_OUT = "/tmp/chatgpt-url.txt";

const PROMPT = (await fs.readFile(PROMPT_FILE, "utf8")).trim();
if (!PROMPT) throw new Error("empty prompt file: " + PROMPT_FILE);

const task = await taskSpace("chatgpt-web");
const page = task.page("p1");

if (!(await page.url()).includes("chatgpt.com")) {
  await page.goto("https://chatgpt.com/", { waitUntil: "load", timeout: 30000 });
}

// 1. 새 채팅 (draft 잔류 방지)
const snap1 = await page.snapshot();
const newChatMatch = snap1.match(/\[ref=(\d+)\][^\n]*\n\s*svg_root\n\s*text "새 채팅"/);
if (newChatMatch) {
  await page.click(`@${newChatMatch[1]}`, { label: "start new chat" });
  await page.waitForTimeout(1500);
}

// 1b. 파일 첨부 (있을 때만; /tmp/chatgpt-files.txt, 한 줄에 절대경로 하나)
let files = [];
try {
  files = (await fs.readFile("/tmp/chatgpt-files.txt", "utf8"))
    .split("\n").map((s) => s.trim()).filter(Boolean);
} catch {}
if (files.length > 0) {
  await page.click('loc=role:button[name="파일 등 추가"]', { label: "open attach menu", timeout: 10000 });
  await page.waitForTimeout(1200);
  const chooserPromise = page.waitForFileChooser({ timeout: 10000 });
  await page.click('text="사진 및 파일 추가"', { label: "attach from computer", timeout: 10000 });
  const chooser = await chooserPromise;
  await chooser.setFiles(files);
  const base = files[files.length - 1].split("/").pop();
  await page.waitForFunction((b) => document.body.innerText.includes(b), base, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

// 2. composer ref 탐색
const snap2 = await page.snapshot();
const composerMatch = snap2.match(/"(ChatGPT에게 물어보세요|ChatGPT와 채팅)" \[ref=(\d+)[,\]]/);
if (!composerMatch) throw new Error("composer not found. snapshot:\n" + snap2.slice(0, 1500));
const composerRef = `@${composerMatch[2]}`;

// 3. 입력
await page.fill(composerRef, PROMPT, { clearFirst: true });
await page.waitForTimeout(800);

// 4. 보내기 버튼 탐색 (입력 후 렌더링까지 폴링)
let sendRef = null;
for (let i = 0; i < 12; i++) {
  const s = await page.snapshot();
  const mm = s.match(/"(보내기|메시지 보내기)" \[ref=(\d+)[,\]]/);
  if (mm) { sendRef = `@${mm[2]}`; break; }
  await page.waitForTimeout(1000);
}
if (!sendRef) throw new Error("send button not found after fill");
await page.click(sendRef, { label: "send ChatGPT prompt" });

// 5. 실제 대화 URL로 이동 대기 (local-chatgpt% 중간 URL 제외)
await page.waitForFunction(
  () => /\/c\/(?!local)[0-9a-f-]{8,}/.test(location.href),
  undefined,
  { timeout: 20000 }
);

// 6. 새 턴 스트리밍 완료 대기 (마커 + 완료신호 둘 다)
// 장시간 생성 대비: /tmp/chatgpt-timeout.txt 에 초 단위 지정 가능 (기본 120)
let TIMEOUT_MS = 120000;
try {
  const t = parseInt((await fs.readFile("/tmp/chatgpt-timeout.txt", "utf8")).trim(), 10);
  if (t > 0) TIMEOUT_MS = t * 1000;
} catch {}
await page.waitForFunction(
  () => document.body.innerText.includes("ChatGPT 답변:") &&
        document.body.innerText.includes("응답이 완료되었습니다"),
  undefined,
  { timeout: TIMEOUT_MS }
);
// 스트리밍 꼬리 안정화
await page.waitForTimeout(2500);

// 7. 마지막 턴 답변 추출
const answer = await page.evaluate(() => {
  const text = document.body.innerText;
  const marker = "ChatGPT 답변:";
  const lastIdx = text.lastIndexOf(marker);
  if (lastIdx === -1) return null;
  const raw = text.slice(lastIdx + marker.length);
  let cut = raw.length;
  for (const m of ["지금까지 대화가 도움이 되었나요?", "이 성격이 마음에 드시나요?", "ChatGPT는 실수할 수 있습니다", "최신 응답", "응답이 완료되었습니다"]) {
    const j = raw.indexOf(m);
    if (j !== -1 && j < cut) cut = j;
  }
  return raw.slice(0, cut).trim();
});

const url = await page.url();
await fs.writeFile(URL_OUT, url, "utf8");
console.log(JSON.stringify({ url, answer }, null, 2));
// 작업 종료 시 스페이스 닫기 (로그인은 프로필 쿠키에 유지, 대화 URL은 sessions.json에 저장됨)
await task.finish({ keep: [] });
