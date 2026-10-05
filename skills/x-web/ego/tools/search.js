// x-web search — X 실시간/인기 검색 결과 JSON.
// 입력: /tmp/x-query.txt (필수), /tmp/x-max.txt (선택 기본 20), /tmp/x-tab.txt (live|top, 기본 live).

const fs = await import("node:fs/promises");
const QUERY = (await fs.readFile("/tmp/x-query.txt", "utf8")).trim();
if (!QUERY) throw new Error("empty query file");
let MAX = 20;
try { MAX = Math.max(1, Math.min(50, parseInt((await fs.readFile("/tmp/x-max.txt", "utf8")).trim(), 10) || 20)); } catch {}
let TAB = "live";
try { TAB = ((await fs.readFile("/tmp/x-tab.txt", "utf8")).trim() || "live"); } catch {}
const F = TAB === "top" ? "top" : "live";

const task = await taskSpace("x-web");
const page = task.page("p1");
await page.goto(`https://x.com/search?q=${encodeURIComponent(QUERY)}&src=typed_query&f=${F}`, {
  waitUntil: "load", timeout: 30000,
});
await page.waitForTimeout(4000);

if ((await page.url()).includes("/i/jf/onboarding")) {
  throw new Error("X login required: hand off space x-web for user login");
}

// lazy-load로 MAX까지 스크롤 수집
let tweets = [];
for (let i = 0; i < 10 && tweets.length < MAX; i++) {
  tweets = await page.evaluate(() => [...document.querySelectorAll('article[data-testid="tweet"]')].map((t) => ({
    user: (t.querySelector('[data-testid="User-Name"]')?.innerText || '').replace(/\n/g, ' ').slice(0, 80),
    text: (t.querySelector('[data-testid="tweetText"]')?.innerText || '').slice(0, 500),
    time: t.querySelector('time')?.getAttribute('datetime') || null,
    url: t.querySelector('a[href*="/status/"]')?.href || null,
    metrics: (t.querySelector('[role="group"]')?.getAttribute('aria-label') || '').slice(0, 120),
  })));
  if (tweets.length < MAX) {
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(2000);
  }
}

console.log(JSON.stringify({ query: QUERY, tab: F, count: tweets.slice(0, MAX).length, tweets: tweets.slice(0, MAX) }, null, 2));
await task.finish({ keep: [] });
