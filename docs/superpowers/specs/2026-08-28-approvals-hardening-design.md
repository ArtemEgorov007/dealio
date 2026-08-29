# Approvals v1 Hardening Design

## Purpose

Make the staging approvals flow safe and usable before acceptance: no secrets in source files, one user action opens one surface, visible pending counts, and opt-in notifications for newly assigned invoices.

## Scope

Included:

- Remove deployed and repository defaults for the approvals bridge token and QA password; rotate the affected values before staging acceptance.
- Prevent action-button and swipe events from also opening the invoice viewer.
- Expose a count of currently visible approval rows and display it on the profile tile and tab bar.
- Offer browser notifications only after an explicit user click; while the ERP page is open, poll once per minute and notify once for each newly observed approval row.
- Extend contract tests and staging smoke evidence.

Excluded:

- Production deployment, push notifications after the browser/app is closed, service-worker delivery, and changes to the source Sheet schema.
- A real approval/rejection write during automated QA. That is a separately controlled staging acceptance step using disposable rows.

## Security Boundary

`APPROVALS_SPREADSHEET_ID` and `APPROVALS_BRIDGE_TOKEN` exist only as Apps Script Script Properties. The PHP API reads the web-app URL and token only from its existing private configuration. No token, spreadsheet identifier, or fallback credential is committed in `gas/`, `scripts/`, tests, or frontend runtime configuration.

The smoke script requires `ERP_QA_LOGIN` and `ERP_QA_PASSWORD` environment variables and exits with a clear setup error when either is absent. It never prints either value.

## Approval Interaction

The card root is responsible only for opening the invoice viewer on an ordinary tap. Its action controls stop pointer and click propagation. A horizontal swipe emits exactly one decision request and suppresses the trailing card click. A decision request opens only the confirmation sheet; confirmation is the only point that calls the decision API.

## Queue Summary and Polling

`GET /api/approvals` continues returning `data.rows` and adds `data.pendingCount`. The server derives it from the filtered, authorized bridge queue; the frontend must not infer authorization by loading another user’s data. The current page and profile/tab-bar use the same authenticated query result shape.

When an authorized user presses `Включить уведомления`, the client requests browser permission. If granted, it retains only the row numbers already seen in this browser session. It reloads the queue every 60 seconds while the page is mounted and emits one notification for each newly observed row. An initial load never notifies. Denied or unavailable permission keeps the normal in-app count and shows an explanatory state.

## Failure Handling

Queue reload failures retain the last known count rather than clearing it. A decision error clears the pending visual state and shows the API message; it does not declare the invoice approved/rejected locally. Browser notification errors never block the queue or decision path.

## Acceptance Evidence

- Full local contract suite remains green, including a regression assertion for a button tap producing only a confirmation sheet.
- PHP approvals tests and authorization tests pass.
- Anonymous API calls are 401, an authenticated employee without `approvals` is 403, and an authorized manager queue is 200.
- A manually controlled staging pair proves approve, reject, audit record, and retry/idempotency.
- No approval token or QA password appears in tracked source; deployed Script Properties/private config are verified without printing values.
