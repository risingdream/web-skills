#!/usr/bin/env bash
# research — 4채널 병렬 수집 → 병합 JSON (stdout).
#   research "질의" [--no-x] [--deep] [--max N] [--compact] [--report]
# 하위 CLI(gsearch/arxiv/yt/x)는 자동 탐색. 실패는 .err에 보존, 종료코드에 합산.
set -u
RESEARCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEEP=0; NOX=0; MAX="10"; PRETTY=1; REPORT=0
PARTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deep) DEEP=1; shift ;;
    --no-x) NOX=1; shift ;;
    --max) MAX="$2"; shift 2 ;;
    --compact) PRETTY=0; shift ;;
    --report) REPORT=1; shift ;;
    --help|-h) sed -n '2,4p' "$0" | sed 's/^# //'; echo 'usage: research [--no-x] [--deep] [--max N] [--compact] [--report] "질의"'; exit 0 ;;
    --) shift; while [[ $# -gt 0 ]]; do PARTS+=("$1"); shift; done ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) PARTS+=("$1"); shift ;;
  esac
done
if [[ ${#PARTS[@]} -eq 0 ]]; then
  if [[ ! -t 0 ]]; then PARTS=("$(cat)"); else
    echo 'usage: research [--no-x] [--deep] [--max N] [--compact] [--report] "질의"' >&2; exit 2
  fi
fi
Q="${PARTS[*]}"

# P0-3: 하위 CLI 자동 탐색 (인접 스킬 dir → ~/.agents/skills → PATH)
find_bin() { # $1=바이너리명 $2...=후보 상대경로
  local bin="$1"; shift
  local roots=(
    "$(dirname "$RESEARCH_DIR")"
    "$HOME"
    "$HOME/.agents/skills"
  )
  for r in "${roots[@]}"; do for c in "$@"; do
    [[ -x "$r/$c/$bin" ]] && { echo "$r/$c/$bin"; return 0; }
  done; done
  command -v "$bin" && return 0
  return 1
}
GSEARCH="$(find_bin gsearch google-search-web/ego/bin)" \
  || { echo "gsearch not found" >&2; exit 3; }
ARXIV="$(find_bin arxiv arxiv-search-web/api/bin)" \
  || { echo "arxiv not found" >&2; exit 3; }
YT="$(find_bin yt youtube-web/ego/bin)" \
  || { echo "yt not found" >&2; exit 3; }
XBIN=""
if [[ "$NOX" == 0 ]]; then
  XBIN="$(find_bin x x-web/ego/bin)" || { echo "x not found, continuing without X" >&2; NOX=1; }
fi
export PATH="$(dirname "$GSEARCH"):$(dirname "$ARXIV"):$(dirname "$YT")${XBIN:+:$(dirname "$XBIN")}:$PATH"

OUT=/tmp/research-$$; mkdir -p "$OUT"
trap 'rm -rf "$OUT"' EXIT  # P0-4: 고아 디렉토리 방지
M="$MAX"; [[ "$DEEP" == 1 ]] && M=$((MAX * 2))

# P2-12: 한글 질의면 라틴 토큰으로 영어 패스 추가
EN_Q="$(printf '%s' "$Q" | grep -o '[A-Za-z][A-Za-z0-9._-]*' | awk 'length>=3' | tr '\n' ' ' | sed 's/ *$//')"
[[ "$EN_Q" == "$Q" ]] && EN_Q=""

# P1-5: X용 축약 쿼리 (긴 질의는 핵심 토큰 3개)
X_Q="$Q"
if [[ "$(printf '%s' "$Q" | wc -w)" -gt 4 ]]; then
  X_Q="$(printf '%s' "$Q" | tr ' ' '\n' | awk '{print length, $0}' | sort -rn | head -3 | awk '{print $2}' | tr '\n' ' ' | sed 's/ *$//')"
fi

run_ch() { # $1=채널명 $2...=명령 — 실패 시 .err 보존 (P0-2)
  local ch="$1"; shift
  if "$@" > "$OUT/$ch.json" 2> "$OUT/$ch.err"; then
    echo -n "" > "$OUT/$ch.ok"
  else
    echo "$?" > "$OUT/$ch.code"
  fi
}
run_ch google "$GSEARCH" --max "$M" "$Q" &
run_ch arxiv "$ARXIV" --max "$M" "$Q" &
run_ch youtube "$YT" --max "$((M > 5 ? 5 : M))" "$Q" &
if [[ -n "$EN_Q" ]]; then
  run_ch google_en "$GSEARCH" --max "$M" "$EN_Q" &
  run_ch arxiv_en "$ARXIV" --max "$M" "$EN_Q" &
else
  touch "$OUT/en_skipped"
fi
if [[ "$NOX" == 0 ]]; then run_ch x "$XBIN" --max "$M" "$Q" & fi
wait

# P1-5: X 0건이면 축약 쿼리로 재시도
if [[ "$NOX" == 0 && "$X_Q" != "$Q" ]] && \
   [[ "$(python3 -c "import json;print(json.load(open('$OUT/x.json')).get('count','?'))" 2>/dev/null)" == "0" ]]; then
  echo "x: 0 results, retrying with shortened query: $X_Q" >&2
  run_ch x "$XBIN" --max "$M" "$X_Q"
fi

if [[ "$DEEP" == 1 ]]; then
  python3 - "$OUT" <<'EOF' > "$OUT/transcripts.json" 2> "$OUT/transcripts.err" || echo "deep-failed" > "$OUT/transcripts.code"
import json, subprocess, sys
out = sys.argv[1]
try:
    yt = json.load(open(f"{out}/youtube.json"))
except Exception as e:
    print(json.dumps([{"error": f"youtube.json unreadable: {e}"[:120]}])); sys.exit()
res = []
for r in (yt.get("results") or [])[:2]:
    entry = {"url": r["url"], "title": r.get("title")}
    got = False
    for lang in ("ko", "en"):  # ko 실패 시 en 폴백
        try:
            p = subprocess.run(["yt", "--transcript", r["url"], "--lang", lang],
                               capture_output=True, text=True, timeout=300)
            t = json.loads(p.stdout)
            if isinstance(t, dict) and t.get("error"):
                raise RuntimeError(t["error"][:200])  # transcript.js 실패 페이로드(stdout)
            entry.update({"lang": t.get("actualLang", lang),
                          "cues": t.get("cues"), "chars": t.get("chars"),
                          "text": (t.get("text") or "")[:8000]})
            got = True
            break
        except Exception as e:
            entry["error"] = f"{lang}: stdout unparseable ({e}) | stderr: {(p.stderr if 'p' in dir() else '')[:200]}".strip()[:300]
            continue
    if not got and "error" not in entry:
        entry["error"] = "transcript failed"
    res.append(entry)
print(json.dumps(res, ensure_ascii=False))
EOF
fi

# P1-7 중복제거·스팸필터 + P2-9 pretty + P2-11 리포트 초안
python3 - "$OUT" "$Q" "$PRETTY" "$REPORT" "$RESEARCH_DIR" <<'EOF'
import json, os, re, sys
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
out, q, pretty, report, rdir = sys.argv[1], sys.argv[2], sys.argv[3] == "1", sys.argv[4] == "1", sys.argv[5]
en_skipped = os.path.exists(f"{out}/en_skipped")

def load(n):
    try:
        return json.load(open(f"{out}/{n}.json"))
    except Exception:
        return None

SPAM_HOSTS = ("scholar.google.", "scholar.googleusercontent.")
TRACKING = {"utm_source", "utm_medium", "utm_campaign", "pp", "si"}

def norm(u):
    try:
        p = urlparse(u)
        if any(h in p.netloc for h in SPAM_HOSTS):
            return None
        q = [(k, v) for k, v in parse_qsl(p.query) if k not in TRACKING]
        return urlunparse((p.scheme, p.netloc.lower(), p.path, "", urlencode(q), "")).rstrip("/")
    except Exception:
        return None

def items(ch, data):
    if isinstance(data, dict):
        arr = data.get("results") or data.get("tweets") or []
    elif isinstance(data, list):
        arr = data
    else:
        return []
    rows = []
    for it in arr:
        u = it.get("url") or ""
        if not (it.get("title") or it.get("text")) or not u:
            continue
        n = norm(u)
        if not n:
            continue
        it["url"] = n  # 표시·키 모두 정규화 URL (pp/si 등 추적 파라미터 제거)
        rows.append({**it, "_ch": ch, "_norm": n})
    return rows

merged, seen, counts = [], set(), {}
for ch in ("google", "google_en", "arxiv", "arxiv_en", "youtube", "x"):
    raw = load(ch)
    collected = len(items(ch, raw))
    kept = 0
    for it in items(ch, raw):
        if it["_norm"] in seen:
            continue
        seen.add(it["_norm"])
        kept += 1
        merged.append({k: v for k, v in it.items() if not k.startswith("_")} | {"channel": it["_ch"]})
    counts[ch] = {"collected": collected, "kept": kept,
                  "status": "skipped" if (en_skipped and ch.endswith("_en"))
                            else ("ok" if raw is not None else "failed")}

errors = {}
for ch in ("google", "arxiv", "youtube", "x", "transcripts"):
    try:
        with open(f"{out}/{ch}.err") as f:
            err = f.read().strip()[-300:]
        if err:
            errors[ch] = err
    except OSError:
        pass

result = {"query": q, "channels": {c: (load(c) is not None) for c in ("google", "arxiv", "youtube", "x")},
          "per_channel_counts": counts,
          "channels_raw": {c: load(c) for c in ("google", "google_en", "arxiv", "arxiv_en", "youtube", "x")},
          "deduped": merged, "count": len(merged), "errors": errors,
          "transcripts": load("transcripts")}
if not report:
    print(json.dumps(result, ensure_ascii=False, indent=2 if pretty else None))
    sys.exit()

# --report: 템플릿 기반 초안
by_ch, urls = {}, {}
for it in merged:
    by_ch.setdefault(it["channel"], []).append(it)
    urls.setdefault(it.get("url", ""), []).append(it["channel"])
lines = [f"# 리서치: {q}", "", "## 채널별 핵심"]
for ch, arr in by_ch.items():
    lines.append(f"### {ch} ({len(arr)}건)")
    for it in arr[:8]:
        t = (it.get("title") or it.get("text") or "")[:90]
        lines.append(f"- {t} [{it.get('url','')}]")
lines.append("")
lines.append("## 교차 검증 후보 (2채널 이상 동일 URL)")
multi = [(u, sorted(set(c))) for u, c in urls.items() if len(set(c)) > 1]
if multi:
    for u, c in multi[:10]:
        lines.append(f"- {', '.join(c)}: {u}")
else:
    lines.append("- 없음 (단일 출처 — 주의)")
lines.append("")
lines.append("## 단일 출처 (주의)")
single = [u for u, c in urls.items() if len(set(c)) == 1][:15]
for u in single:
    lines.append(f"- {u}")
if errors:
    lines.append("")
    lines.append("## 채널 오류")
    for ch, e in errors.items():
        lines.append(f"- {ch}: {e[:200]}")
print("\n".join(lines))
EOF
fail=0; for c in google arxiv youtube x; do [[ -f "$OUT/$c.code" ]] && fail=$((fail+1)); done
exit $fail
