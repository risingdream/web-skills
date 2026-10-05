---
name: research-web
description: Multi-angle web research orchestrator. Fans a query out to Google, arXiv, YouTube, and X in parallel, merges evidence with citations, and writes a structured report. Use when the user says /research, needs deep research, literature survey, or multi-source investigation.ko: 다각도 리서치가 필요할 때 사용.
---

# research-web skill

단일 검색을 넘어 4개 채널을 병렬 수집 → 중복 제거 → 종합 리포트를 만드는
메타 스킬. 실행은 하위 스킬 CLI를 그대로 사용.

## 사용 (`tools/collect.sh`, `tools/report-template.md` 참조)

```bash
research "질의"                 # 4채널 수집 + 병합 JSON (pretty)
research --no-x "질의"          # X 제외 (로그인 이슈·속보 불필요 시)
research --deep "질의"          # 건당 2배 수집 + 유튜브 자막 본문 포함
research --compact "질의"       # 1행 JSON
research --report "질의"        # 수집 + 마크다운 초안
```

하위 CLI는 래퍼가 자동 탐색 (인접 스킬 dir → `~/.agents/skills` → PATH).
수동 `export PATH` 불필요.

## 워크플로우 (에이전트가 수행)

1. **수집** (`bin/research` → `tools/collect.sh`): google + arxiv +
   youtube + x 병렬. 채널 실패는 `.err` 보존·종료코드 합산.
   임시 dir은 trap으로 정리.
2. **정리** (collect 내장): URL 정규화 중복 제거, scholar 미러 등 스팸 제외,
   빈 항목 제외. X 장문 쿼리는 토큰 축약 후 재시도.
   한글 질의면 라틴 토큰 영어 패스 추가.
3. **종합**: 채널별 핵심 → 교차 검증(2개 이상 출처) → 불일치 명시.
4. **리포트**: `report-template.md` 구조 (요약·근거·출처·한계).
   모든 주장에 출처 URL. 확실하지 않으면 "미확인" 표기.

## 원칙

- 인용 없는 단정 금지. 단일 출처 주장과 다중 출처 사실을 구분.
- 최신성 충돌 시 발행일 명시하고 둘 다 기록.
- 자막·트윗은 1차 자료가 아님. 원문 링크를 함께 둠.
