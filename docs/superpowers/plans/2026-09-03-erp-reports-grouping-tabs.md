# Reports Detail Grouping Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add client-side grouping tabs (Раздельно | Договор | Площадка) to reports detail without changing KPI summary.

**Architecture:** Pure util `groupReportRows` + UI tabs in `ErpReportsTable.vue`. No API/GAS/PHP changes.

**Tech Stack:** Nuxt 4, TypeScript, `UiSegmentedControl`, `node --test` + `loadTsModule`.

**Spec:** User TZ «Отчеты: корректировки интерфейса и сведения информации» + advisor 2026-09-03.

## Global Constraints

- Staging only (`erp-mt.online`). No prod.
- Do not change `ErpReportsSummary` / KPI cards.
- Three tabs only (no Заказчик tab).
- Grouped views: ТП + Отгружено only (no «В цехе» in group rows).
- No commit/push unless asked.

---

### Task 1: RED tests

**Files:**
- Create: `tests/reports-grouping.test.mjs`
- Modify: `tests/reports-contract.test.mjs` (grep for tabs)

- [x] Write unit tests for `groupReportRows`
- [x] Write contract greps for tabs/Итого/UiSegmentedControl
- [x] Confirm RED

### Task 2: GREEN util + UI

**Files:**
- Create: `app/utils/erp-report-grouping.ts`
- Modify: `app/components/erp/ErpReportsTable.vue`

- [x] Implement grouping util
- [x] Wire tabs + flat/group views
- [x] Confirm GREEN + typecheck

### Task 3: Staging

- [x] Generate + deploy static (`staging-fade-tabs-20260903-1557`, includes grouping + scroll fade)
- [ ] Note phone acceptance — проверить табы «Заявки» и «Детализация» на телефоне
