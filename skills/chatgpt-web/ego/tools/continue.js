// chatgpt-web continue — 기존 대화 URL에서 이어서 질문.
// 입력 파일: /tmp/chatgpt-url.txt (대화 URL), /tmp/chatgpt-prompt.txt (후속 질문).
// 출력: 마지막 턴 답변 JSON. process.env 사용 금지 (임베디드 런타임 미상속).

const fs = await import("node:fs/promises");
const URL = (await fs.readFile("/tmp/chatgpt-url.txt", "utf8")).trim();
const PROMPT = (await fs.readFile("/tmp/chatgpt-prompt.txt", "utf8")).trim();
if (!URL || !PROMPT) throw new Error("url/prompt file required");

const task = await taskSpace("chatgpt-web");
const page = task.page("p1");
await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(
  () => document.body.innerText.includes("응답이 완료되었습니다") ||
        document.body.innerText.includes("ChatGPT 답변:"),
  undefined,
  { timeout: 30000 }
);

const snap = await page.snapshot();
const composerMatch = snap.match(/"(ChatGPT에게 물어보세요|ChatGPT와 채팅)" \[ref=(\d+)[,\]]/);
if (!composerMatch) throw new Error("composer not found");
await page.fill(`@${composerMatch[2]}`, PROMPT, { clearFirst: true });
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
await page.click(sendRef, { label: "send follow-up prompt" });

const before = await page.evaluate(() => document.body.innerText.length);
await page.waitForFunction(
  (prevLen) => !document.body.innerText.includes("응답이 완료되었습니다") ||
               document.body.innerText.length !== prevLen,
  before,
  { timeout: 15000 }
).catch(() => {});
let TIMEOUT_MS = 120000;
try {
  const t = parseInt((await fs.readFile("/tmp/chatgpt-timeout.txt", "utf8")).trim(), 10);
  if (t > 0) TIMEOUT_MS = t * 1000;
} catch {}
await page.waitForFunction(
  () => document.body.innerText.includes("응답이 완료되었습니다"),
  undefined,
  { timeout: TIMEOUT_MS }
);

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

console.log(JSON.stringify({ url: await page.url(), answer }, null, 2));
// 작업 종료 시 스페이스 닫기 (로그인은 프로필 쿠키에 유지)
await task.finish({ keep: [] });
