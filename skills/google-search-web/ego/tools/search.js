// google-search — 구글 오가닉 결과 JSON 반환.
// 입력: /tmp/gsearch-query.txt (필수), /tmp/gsearch-max.txt (선택, 기본 10).
// 출력: [{title, url, snippet}]. process.env 사용 금지.

const fs = await import("node:fs/promises");
const QUERY = (await fs.readFile("/tmp/gsearch-query.txt", "utf8")).trim();
if (!QUERY) throw new Error("empty query file");
let MAX = 10;
try { MAX = Math.max(1, Math.min(50, parseInt((await fs.readFile("/tmp/gsearch-max.txt", "utf8")).trim(), 10) || 10)); } catch {}

const task = await taskSpace("google-search");
const page = task.page("p1");
await page.goto(`https://www.google.com/search?q=${encodeURIComponent(QUERY)}&num=${MAX}&hl=ko`, {
  waitUntil: "load", timeout: 30000,
});
await page.waitForTimeout(1500);

// 동의 페이지 처리
const consent = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 10));
const agreeBtn = consent.find((t) => /^(동의|Accept all|Alle akzeptieren|I agree)$/i.test(t));
if (agreeBtn && !consent.some((t) => t.length > 60)) {
  const all = await page.snapshot();
  const m = all.match(new RegExp(`"(?:${agreeBtn})" \\[ref=(\\d+)[,\\]]`));
  if (m) {
    await page.click(`@${m[1]}`, { label: "accept consent" });
    await page.waitForTimeout(2000);
  }
}

await page.waitForSelector("div#search", { timeout: 15000 });
// 구 div.g 구조가 사라짐 (실측). div#search h3 + 인근 http 앵커로 추출.
const results = await page.evaluate((max) => {
  const out = [];
  const seen = new Set();
  for (const h of document.querySelectorAll('div#search h3')) {
    const title = (h.innerText || '').trim();
    if (!title) continue;
    const link = h.closest('a')?.href
      || h.parentElement?.parentElement?.querySelector('a[href^="http"]')?.href
      || '';
    if (!link || seen.has(link)) continue;
    seen.add(link);
    const block = h.closest('div[data-hveid]') || h.parentElement?.parentElement;
    const snippet = ((block?.innerText || '').replace(title, '').trim().slice(0, 300));
    out.push({ title: title.slice(0, 200), url: link, snippet });
    if (out.length >= max) break;
  }
  return out;
}, MAX);

console.log(JSON.stringify({ query: QUERY, count: results.length, results }, null, 2));
await task.finish({ keep: [] });
