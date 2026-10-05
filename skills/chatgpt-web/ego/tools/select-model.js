// chatgpt-web select-model — 추론/모델 선택.
// 입력: /tmp/chatgpt-model.txt 에 원하는 모델명 부분문자열 (예: "GPT-5.5").
// 실측 메뉴 구조: button "ChatGPT 모델 선택" → menu "추론 수준" →
//   menuitem "모델 선택"(High) / menuitem "파워"(+slider) /
//   menuitemradio "GPT-5.6 Sol" / menuitemradio "GPT-5.5" ...

const fs = await import("node:fs/promises");
const WANT = (await fs.readFile("/tmp/chatgpt-model.txt", "utf8")).trim();
if (!WANT) throw new Error("empty model file");

const task = await taskSpace("chatgpt-web");
const page = task.page("p1");
if (!(await page.url()).includes("chatgpt.com")) {
  await page.goto("https://chatgpt.com/", { waitUntil: "load", timeout: 30000 });
}

// 모델 버튼 열기 (aria-label 기반; ref는 매번 변함)
await page.click('loc=role:button[name="ChatGPT 모델 선택"]', { label: "open model picker", timeout: 10000 });
await page.waitForSelector('loc=role:menu', { timeout: 8000 }).catch(() => {});

const picked = await page.evaluate((want) => {
  const radios = [...document.querySelectorAll('[role="menuitemradio"]')];
  const norm = (s) => (s || '').toLowerCase();
  const hit = radios.find((el) => norm(el.innerText).includes(norm(want)));
  if (!hit) {
    return { ok: false, options: radios.map((el) => (el.innerText || '').trim().slice(0, 60)) };
  }
  hit.click();
  return { ok: true, picked: hit.innerText.trim().slice(0, 80) };
}, WANT);

if (!picked.ok) {
  await page.keyboard.press("Escape").catch(() => {});
  throw new Error("model not found: " + WANT + " options=" + JSON.stringify(picked.options));
}
await page.waitForTimeout(1200);
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(500);

const current = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label="ChatGPT 모델 선택"]')][0]?.innerText?.trim() || null
);
console.log(JSON.stringify({ want: WANT, picked: picked.picked, buttonNow: current }));
// 모델 선택만 단독 실행된 경우 스페이스 닫기 (--model+ask 조합이면 ask가 새 스페이스로 이어받음)
await task.finish({ keep: [] });
