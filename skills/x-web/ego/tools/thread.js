// x-web thread — 트윗 본문 + 답글 JSON.
// 입력: /tmp/x-url.txt (status URL).

const fs = await import("node:fs/promises");
const URL = (await fs.readFile("/tmp/x-url.txt", "utf8")).trim();
if (!URL.includes("/status/")) throw new Error("status URL required");

const task = await taskSpace("x-web");
const page = task.page("p1");
await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(4000);

const out = await page.evaluate(() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  const one = (t) => ({
    user: (t.querySelector('[data-testid="User-Name"]')?.innerText || '').replace(/\n/g, ' ').slice(0, 80),
    text: (t.querySelector('[data-testid="tweetText"]')?.innerText || '').slice(0, 1000),
    time: t.querySelector('time')?.getAttribute('datetime') || null,
    url: t.querySelector('a[href*="/status/"]')?.href || null,
    metrics: (t.querySelector('[role="group"]')?.getAttribute('aria-label') || '').slice(0, 120),
  });
  return { main: arts.length ? one(arts[0]) : null, replies: arts.slice(1, 11).map(one) };
});

console.log(JSON.stringify({ url: URL, ...out }, null, 2));
await task.finish({ keep: [] });
