#!/usr/bin/env python3
"""arxiv-search-web search — arXiv export API 검색, JSON 출력 (stdlib only)."""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

NS = {"a": "http://www.w3.org/2005/Atom"}


def search(query, max_n=10, sort="relevance"):
    """기본: 웹 검색 HTML. 실패 시 export API로 폴백."""
    try:
        out = search_html(query, max_n, sort)
        if out:
            return out
    except Exception:
        pass
    return search_api(query, max_n, sort)


def search_api(query, max_n=10, sort="relevance"):
    sort_by = "submittedDate" if sort == "new" else "relevance"
    # P1-6: all: OR 매칭은 정밀도 붕괴 → 제목/초록 필드 가중
    phrase = query if query.startswith('"') else f'"{query}"' if " " in query else query
    fielded = f"ti:{phrase} OR abs:{phrase}"
    q = urllib.parse.urlencode({
        "search_query": fielded,
        "start": 0, "max_results": max_n,
        "sortBy": sort_by, "sortOrder": "descending",
    })
    req = urllib.request.Request(
        f"https://export.arxiv.org/api/query?{q}",
        headers={"User-Agent": "arxiv-search-web/1.0 (research CLI)"},
    )
    body = None
    for attempt in range(4):
        if attempt:
            time.sleep(5 * attempt)  # arXiv 레이트리밋(3초 간격 권장) 대응
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
        except Exception:
            continue
        if body and b"Rate exceeded" not in body:
            break
        body = None
    if not body:
        return search_html(query, max_n, sort)
    root = ET.fromstring(body)
    out = []
    for e in root.findall("a:entry", NS):
        pid = (e.find("a:id", NS).text or "").strip().rsplit("/abs/", 1)[-1]
        out.append({
            "id": pid,
            "title": " ".join((e.find("a:title", NS).text or "").split()),
            "authors": [a.find("a:name", NS).text for a in e.findall("a:author", NS)],
            "summary": " ".join((e.find("a:summary", NS).text or "").split())[:2000],
            "published": (e.find("a:published", NS).text or "")[:10],
            "url": f"https://arxiv.org/abs/{pid}",
            "pdf": f"https://arxiv.org/pdf/{pid}",
        })
    return out


def clean(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s or "")).split())


def search_html(query, max_n=10, sort="relevance"):
    """export API 스로틀 시 폴백: arxiv.org 검색 HTML 파싱."""
    order = "&order=-announced_date_first" if sort == "new" else ""
    webq = query if query.startswith('"') or " " not in query else f'"{query}"'
    q = urllib.parse.urlencode({"query": webq, "searchtype": "all", "source": "header"})
    req = urllib.request.Request(
        f"https://arxiv.org/search/?{q}{order}",
        headers={"User-Agent": "arxiv-search-web/1.0 (research CLI)"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        page = r.read().decode("utf-8", "replace")
    out = []
    for m in re.finditer(r'<li class="arxiv-result">(.*?)</li>', page, re.S):
        b = m.group(1)
        im = re.search(r'href="https://arxiv\.org/abs/([\w./-]+)"', b)
        if not im:
            continue
        pid = im.group(1)
        tm = re.search(r'<p class="title[^>]*>(.*?)</p>', b, re.S)
        am = re.search(r'<p class="authors">(.*?)</p>', b, re.S)
        fm = re.search(r'<span class="abstract-full[^>]*>', b)
        summary = clean(b[fm.end():fm.end() + 3000])[:2000] if fm else ""
        dm = re.search(r"[Ss]ubmitted</span>\s*([^;<]+)", b)
        authors = [clean(a) for a in re.findall(r"<a[^>]*>(.*?)</a>", am.group(1), re.S) if clean(a)][:8]
        out.append({
            "id": pid,
            "title": clean(tm.group(1)) if tm else "",
            "authors": authors,
            "summary": summary,
            "published": dm.group(1).strip() if dm else "",
            "url": f"https://arxiv.org/abs/{pid}",
            "pdf": f"https://arxiv.org/pdf/{pid}",
        })
        if len(out) >= max_n:
            break
    return out


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--max", type=int, default=10)
    ap.add_argument("--sort", default="relevance", choices=["relevance", "new"])
    a = ap.parse_args()
    print(json.dumps(search(a.query, a.max, a.sort), ensure_ascii=False, indent=2))
