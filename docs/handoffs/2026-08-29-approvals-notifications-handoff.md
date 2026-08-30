# Handoff: approvals notifications — Android / cross-device reliability

Paste the prompt below into Cursor or Claude in the `dealio-product-readiness` worktree.

---

You are taking over an ERP staging reliability issue. Work carefully and independently: diagnose first, then implement only the smallest safe fix. Do not commit, push, deploy to production, reveal secrets, rotate keys, change Google Sheet sharing, or delete test data without explicit approval.

## Local access note (never copy into this prompt or repository)

If staging access is required, read `/Users/ghpr/Desktop/ERP_доступы_локально.md` locally. It is permission-restricted and intentionally outside Git. Use its values only for the named staging checks; do not print them, put them in an environment dump, paste them into a chat, commit them, or use them against production. Private GAS bridge properties and server API configuration remain the source of truth for their own secrets.

## Product and environment

- Repository/worktree: `/Users/ghpr/.codex/worktrees/dealio-product-readiness`
- Branch: `codex/product-readiness`
- Staging only: `https://erp-mt.online`
- Production `https://erp-mt.ru` is out of scope and must not be changed.
- This is a Nuxt 4 SPA (`ssr: false`) + PHP same-origin API + MySQL session/identity layer + protected Google Apps Script bridge for approvals.
- The source approval data is Google spreadsheet `Склад`, sheet `Согласования`. Do not print its private bridge configuration or credentials.

## User-visible requirement

For a user who has access to “Согласования”, when a new invoice becomes available for their approval:

1. It must be clearly surfaced inside the open ERP on iPhone and Android.
2. System/browser notifications should be offered when the platform can genuinely support them.
3. We need a technically honest path to real background notifications (when ERP/browser is closed), not a claim that interval polling is push.
4. The immediate incident: iPhone appears to receive the notification flow; Android is intermittent (“через раз”), and manager Max does not receive it on Android.

## What already works

Approvals v1 itself is working on staging:

- Queue endpoint: `GET /api/approvals`.
- Decision endpoint: `POST /api/approvals/decisions`.
- Role/actor filtering happens in the protected GAS bridge.
- Manager queue and actual approve/reject path were tested with controlled staging rows.
- Decision writes are idempotent and audit once.
- Swipe/card interaction is fixed: action clicks open only the decision confirmation; card clicks open only the invoice viewer.
- Pending-count badges exist in profile and tab bar.

Key files:

- `app/pages/approvals.vue` — notification lifecycle and approvals page UI.
- `store/erp-approvals.store.ts` — canonical queue + pending count.
- `app/utils/erp-sheets.ts` and `app/utils/erp-api.ts` — API transport.
- `app/components/erp/ErpApprovalCard.vue`, `ErpInvoiceViewer.vue`.
- `public/api/src/Approvals.php` — authenticated PHP boundary.
- `scripts/erp-approvals-bridge.gs` — protected GAS source bridge.
- `tests/approvals-contract.test.mjs` — behavioural contract tests.
- `docs/superpowers/specs/2026-08-28-invoice-approvals-design.md` and `docs/superpowers/plans/2026-08-28-approvals-hardening.md` — prior decisions.

## Current implementation and its known limitation

`app/pages/approvals.vue` currently does the following:

- polls the queue every 60 seconds while the page is mounted;
- tracks seen `rowNumber`s in `sessionStorage` key `erp-approval-notification-row-numbers`;
- shows an in-app notice `Новый счёт на согласование: …` for an unread queue item, including on first load;
- when `window.Notification` exists and permission is `granted`, additionally calls `new Notification(...)`;
- shows a button only when native permission is `default`.

This is **not Web Push**. There is no service worker registration, no Push API subscription, no VAPID keys, no endpoint to store subscriptions, and no server-side push sender. `public/manifest.json` exists, but a manifest alone does not create a PWA push channel.

The earlier banner “Уведомления не поддерживаются этим браузером” was replaced by “Новые счета будут показаны внутри ERP”; polling now starts even without native Notification support. This is a fallback, not proof that Android push works.

## Important root-cause hypotheses to verify, not assume

1. On iPhone, ordinary browser tabs may not expose the Notification API; iOS support depends on installed Home Screen web apps and platform/browser version. Do not label this as a generic application bug without checking.
2. Android Chrome/Yandex may expose `Notification`, but permission, OS notification channel, browser site settings, battery optimization, background restrictions, or a missing service worker can prevent the expected behaviour.
3. The current `sessionStorage` baseline intentionally suppresses duplicate alerts, but it can make a user miss a visible “new” signal if the invoice arrived before the page was opened. The current in-app first-load fallback was added to reduce that problem.
4. `setInterval` runs only while the page is alive. It cannot notify a closed/minimized browser reliably.

## Current controlled test data

Two temporary staging approvals are currently assigned to `Вдовыкин Максим Сергеевич` for device testing:

- `ERP-TEST-NOTIFY-20260829`
- `ERP-TEST-NOTIFY-ALL-20260829`

They are valid test rows in the staging `Согласования` sheet, amount 1 ₽. They make the queue show two pending items for `m.vdovykin`. Do not approve, reject, mutate, or delete them unless the user explicitly directs it. If a fresh-arrival scenario is needed, obtain action-time authorization before adding any further row.

## Constraints and safety

- Preserve all unrelated uncommitted work. The worktree is intentionally dirty and contains broad prior ERP work.
- Never log, paste, commit, or hardcode credentials, MySQL passwords, GAS bridge tokens, spreadsheet tokens, cookie values, VAPID private keys, or full auth responses.
- Do not call production, alter production deploy paths, or change Google Sheet access.
- Do not treat test invoices as disposable until explicitly authorized.
- Do not claim real push delivery until it has been verified on a physical Android device and the delivery conditions are stated precisely.

## Required approach

1. Read the files above and run the existing targeted tests before touching code:

   ```bash
   node --test tests/approvals-contract.test.mjs
   php tests/php/approvals-test.php
   php tests/php/approvals-authorization-test.php
   ```

2. Reproduce and collect evidence. For each Android browser tested, record (without sensitive data):
   - device/browser/version;
   - secure context;
   - `Notification` availability and permission state;
   - service worker availability/registration state;
   - PushManager availability;
   - whether page is foreground/background/closed;
   - exactly whether the in-app notice, native notification, and badge update occur.

3. Decide and document the boundary:
   - **Immediate safe fix:** reliable in-app unread notification and queue/badge refresh on Android and iPhone while ERP is open.
   - **Real background notifications:** design an explicit Web Push/PWA delivery path. This likely needs service worker registration, Push API subscription, a secure subscription store keyed to the authenticated employee, VAPID configuration stored privately, a server-side sender, revocation/logout handling, and an event trigger when a new approval appears. Do not fake this with a polling loop.

4. If implementing a code fix, use TDD: add a test that fails for the observed Android-equivalent condition, run it red, make the minimal fix, then run it green. Keep native notification permissions opt-in only; never call permission requests automatically on page load.

5. If background Web Push is too large to safely finish in this pass, deliver a short implementation plan instead of a half-built feature. It must identify precise data/API changes and acceptance tests.

6. Before any staging deployment, run fresh verification:

   ```bash
   node --test tests/*.test.mjs
   php tests/php/approvals-test.php
   php tests/php/approvals-authorization-test.php
   npm run typecheck
   NUXT_PUBLIC_ERP_BACKEND_MODE=sql NUXT_PUBLIC_ERP_API_BASE=/api npm run generate
   git diff --check
   ```

   Staging static deployment is only to `erp-mt.online`, never production. Verify the published hashed bundle contains the changed code after deploy.

## Acceptance criteria

Return a PASS/FAIL report with evidence for each:

- Android Chrome: an unread/new approval reliably appears in the open ERP and badge/count updates.
- Android Yandex Browser: same result, or an explicit platform limitation with safe in-app fallback.
- iPhone Safari/PWA: same result with correct conditions.
- Native notification permission is requested only through an explicit user tap.
- A user cannot receive duplicate in-app/native notices for the same row in one session.
- A new approval arriving after the page is open is detected within the stated polling interval.
- A pending approval already present when the user opens ERP is visibly called out, not silently baselined.
- No regression in approval queue, approve/reject, idempotency, audit, or role filtering.
- If claiming background notifications, verify on a physical Android device with ERP/browser closed; otherwise explicitly state that closed-app push is not implemented.

## Deliverable format

1. Root cause(s) with evidence.
2. Files changed and why.
3. Test commands/results.
4. Staging deployment evidence, if deployed.
5. Remaining limitations and a separate next step for true Web Push, if needed.

Do not commit or push unless the user explicitly asks.
