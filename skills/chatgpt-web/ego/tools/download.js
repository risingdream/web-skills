// chatgpt-web download — 저장된 대화 URL에서 파일/생성 이미지를 내려받음.
// 입력: /tmp/chatgpt-url.txt (대화 URL), /tmp/chatgpt-downdir.txt (선택, 저장 dir. 기본 /tmp/chatgpt-downloads)
// 케이스:
//   A. 파일 응답: button "파일 다운로드" (부모 오버레이에 가려 일반 click 실패 → evaluate 폴백)
//   B. 생성 이미지: 이미지 버튼 클릭 → "다운로드" 버튼 → download 이벤트
// 출력: 내려받은 파일 목록 JSON. process.env 사용 금지.

const fs = await import("node:fs/promises");
const path = await import("node:path");
const URL = (await fs.readFile("/tmp/chatgpt-url.txt", "utf8")).trim();
if (!URL) throw new Error("url file required");
let DIR = "/tmp/chatgpt-downloads";
try { DIR = (await fs.readFile("/tmp/chatgpt-downdir.txt", "utf8")).trim() || DIR; } catch {}
await fs.mkdir(DIR, { recursive: true });

const task = await taskSpace("chatgpt-web");
const page = task.page("p1");
await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2500);

const saved = [];

// B 먼저: 생성 이미지가 있으면 이미지 버튼을 열어 다운로드 메뉴 노출
const hasImage = await page.evaluate(() =>
  [...document.querySelectorAll('main img')].some((el) => /생성된 이미지/.test(el.alt || '')));
if (hasImage) {
  await page.click('loc=role:button[name="생성된 이미지 1"]', { label: "open generated image", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

// A+B 공통: 다운로드 계열 버튼을 순서대로 처리
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((el) => el.getAttribute('aria-label') || '').filter(Boolean));
const targets = labels.filter((l) => l === "파일 다운로드" || l === "다운로드");
const seen = new Set();
for (const label of targets) {
  if (seen.has(label)) continue;
  seen.add(label);
  try {
    const dlPromise = page.waitForEvent("download", { timeout: 20000 });
    // 오버레이 가림 대비: 일반 클릭 시도 후 실패하면 evaluate 직접 클릭
    try {
      await page.click(`loc=role:button[name="${label}"]`, { label: `download ${label}`, timeout: 5000 });
    } catch {
      await page.evaluate((l) => {
        document.querySelector(`button[aria-label="${l}"]`)?.click();
      }, label);
    }
    const dl = await dlPromise;
    const dest = path.join(DIR, dl.suggestedFilename());
    await dl.saveAs(dest);
    saved.push(dest);
  } catch (e) {
    console.log(`skip ${label}: ${String(e).split("\n")[0].slice(0, 120)}`);
  }
}

console.log(JSON.stringify({ url: URL, dir: DIR, saved }, null, 2));
await task.finish({ keep: [] });
