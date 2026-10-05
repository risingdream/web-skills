// youtube-web meta — 영상 메타데이터 + 설명 + 챕터 JSON.
// 입력: /tmp/yt-url.txt (watch URL).

const fs = await import("node:fs/promises");
const URL = (await fs.readFile("/tmp/yt-url.txt", "utf8")).trim();
if (!URL.includes("youtube.com/watch")) throw new Error("watch URL required");

const task = await taskSpace("youtube-web");
const page = task.page("p1");
await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3000);

const meta = await page.evaluate(() => ({
  title: document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText?.trim() || document.title.replace(/ - YouTube$/, ''),
  channel: document.querySelector('ytd-channel-name a')?.innerText?.trim() || null,
  views: [...document.querySelectorAll('ytd-watch-metadata span')].map((s) => s.innerText).find((t) => /조회수|views/i.test(t)) || null,
  description: (document.querySelector('ytd-text-inline-expander')?.innerText || '').trim().slice(0, 2000),
  chapters: [...new Set(
    [...document.querySelectorAll('ytd-macro-markers-list-item-renderer')]
      .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 120))
  )].slice(0, 30),
}));

console.log(JSON.stringify({ url: URL, ...meta }, null, 2));
await task.finish({ keep: [] });
