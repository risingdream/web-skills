// youtube-web transcript — yt-dlp 경유 자막 JSON 추출 (브라우저 불필요).
// 배경: timedtext 직접 호출은 pot 게이트로 200-empty, UI get_transcript는 400.
// yt-dlp(+node JS runtime)가 플레이어 챌린지를 풀고 자막을 내려받음 (실측).
// 사용: node tools/transcript.js <videoId|URL> [lang] [outdir]
// 출력: {videoId, lang, file, cues, text} JSON (stdout). 실패 시 exit 1.

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const [video, lang = "ko", outdir = "/tmp/yt-subs"] = process.argv.slice(2);
if (!video) { console.error("usage: transcript.js <videoId|URL> [lang] [outdir]"); process.exit(2); }
const id = (video.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1] || video;
await fs.mkdir(outdir, { recursive: true });

const run = (args) => new Promise((resolve) => {
  execFile("yt-dlp", args, { timeout: 180000 }, (err, stdout, stderr) =>
    resolve({ ok: !err, out: (stdout + stderr).slice(-800) }));
});

let file = null;
let lastLog = "";
for (let attempt = 0; attempt < 3 && !file; attempt++) {
  if (attempt > 0) await new Promise((r) => setTimeout(r, 45000 * attempt));
  const res = await run(["--js-runtimes", "node", "--write-auto-subs", "--write-subs",
    "--sub-langs", lang, "--skip-download", "-o", `${outdir}/%(id)s.%(ext)s`,
    `https://www.youtube.com/watch?v=${id}`]);
  lastLog = res.out;
  const files = (await fs.readdir(outdir)).filter((f) => f.startsWith(id + "."));
  file = files.find((f) => f.includes(`.${lang}.`)) || files[0] || null;
  if (!file && /429/.test(res.out)) continue;
  if (!file) { console.error(JSON.stringify({ error: "no subtitles", log: res.out.slice(-300) })); process.exit(1); }
}
if (!file) {
  console.error(JSON.stringify({ error: "no subtitles after 3 attempts (likely 429)", log: lastLog.slice(-300) }));
  process.exit(1);
}
// 요청 언어와 다르면 실제 받은 트랙 언어를 기록
const actualLang = (file.match(/\.([a-zA-Z-]{2,8})\.(vtt|srt|ttml)$/) || [])[1] || lang;

const raw = await fs.readFile(path.join(outdir, file), "utf8");
const cues = [];
const blocks = raw.replace(/\r/g, "").split(/\n\s*\n/);
const ts = (s) => {
  const m = s.match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
};
for (const b of blocks) {
  const lines = b.trim().split("\n");
  if (lines.length < 2) continue;
  const tline = lines.find((l) => l.includes("-->"));
  if (!tline) continue;
  const [a, c] = tline.split("-->");
  const text = lines.slice(lines.indexOf(tline) + 1).join(" ")
    .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  if (text) cues.push({ start: ts(a), dur: +(ts(c) - ts(a)).toFixed(2), text });
}
console.log(JSON.stringify({
  videoId: id, lang, actualLang, file: path.join(outdir, file),
  cues: cues.length, chars: cues.map((c) => c.text).join(" ").length,
  head: cues.slice(0, 3),
  text: cues.map((c) => c.text).join(" "),
}));
