// youtube-web search — 동영상 검색 결과 JSON.
// 입력: /tmp/yt-query.txt (필수), /tmp/yt-max.txt (선택 기본 10).

const fs = await import("node:fs/promises");
const QUERY = (await fs.readFile("/tmp/yt-query.txt", "utf8")).trim();
if (!QUERY) throw new Error("empty query file");
let MAX = 10;
try { MAX = Math.max(1, Math.min(30, parseInt((await fs.readFile("/tmp/yt-max.txt", "utf8")).trim(), 10) || 10)); } catch {}

const task = await taskSpace("youtube-web");
const page = task.page("p1");
await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(QUERY)}`, {
  waitUntil: "load", timeout: 30000,
});
await page.waitForFunction(
  () => document.querySelectorAll('ytd-video-renderer').length > 0,
  undefined, { timeout: 20000 }
);

const results = await page.evaluate((max) => [...document.querySelectorAll('ytd-video-renderer')].slice(0, max).map((el) => ({
  title: el.querySelector('#video-title')?.innerText?.trim() || null,
  url: el.querySelector('#video-title')?.href || null,
  channel: el.querySelector('ytd-channel-name a')?.innerText?.trim() || null,
  meta: el.querySelector('#metadata-line')?.innerText?.replace(/\n/g, ' ').trim().slice(0, 80) || null,
  duration: el.querySelector('ytd-thumbnail-overlay-time-status-renderer')?.innerText?.trim() || null,
})).filter((r) => r.title && r.url), MAX);

console.log(JSON.stringify({ query: QUERY, count: results.length, results }, null, 2));
await task.finish({ keep: [] });
