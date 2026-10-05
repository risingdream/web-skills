# web-skills

Browser-driven web research skills with pluggable backends.
No site APIs for browser skills — only real browser UI automation.

## Skills

| Skill | What | CLI |
|---|---|---|
| `chatgpt-web` | Ask ChatGPT via `chatgpt.com`: sessions, file attach, model select, long tasks, downloads | `skills/chatgpt-web/ego/bin/chatgpt` |
| `google-search-web` | Google organic results as JSON | `skills/google-search-web/ego/bin/gsearch` |
| `youtube-web` | Video metadata, search, chapters, transcripts (yt-dlp) | `skills/youtube-web/ego/bin/yt` |
| `x-web` | X search (live/top), threads, replies, metrics | `skills/x-web/ego/bin/x` |
| `arxiv-search-web` | arXiv search (web-first, API fallback), PDF download | `skills/arxiv-search-web/api/bin/arxiv` |
| `research-web` | Multi-channel research orchestrator (all of the above) | `skills/research-web/bin/research` |

## Backends

- `ego/` — [Ego Lite](https://github.com/citrolabs/ego-lite) (`ego-browser`).
  Current default, verified.
- `api/` — official APIs where they exist (arXiv, YouTube transcripts via yt-dlp).
- `aside/` — Aside browser. Planned.
- `references/` under each skill holds backend-agnostic site knowledge
  (selectors, completion markers, edge cases) shared by all backends.

## Install (Claude Code plugin)

```
/plugin marketplace add risingdream/web-skills
/plugin install web-skills@risingdream/web-skills
```

## Install (manual — also works for Codex and OpenCode)

```bash
git clone https://github.com/risingdream/web-skills.git ~/web-skills
for s in chatgpt-web google-search-web youtube-web x-web arxiv-search-web research-web; do
  ln -s ~/web-skills/skills/$s ~/.agents/skills/$s
  ln -s ../../.agents/skills/$s ~/.claude/skills/$s
done
```

Per-machine state (`sessions.json`) lives next to each backend and is
git-ignored. Browser skills hand the browser over for first-run login.
