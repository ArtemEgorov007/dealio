# ERP incident stabilization

## Goal

Restore stable access to ERP, make the Personnel flow predictable, and prevent a stale static build from presenting obsolete screens.

## Scope

1. Treat `https://erp-mt.ru` as the only canonical browser origin. The client redirects HTTP and `www` variants before the ERP store is initialized; hosting will then receive the matching permanent redirect rule.
2. Keep a valid locally stored employee profile when the profile schema version changes. Invalid or unreadable storage is still discarded.
3. Make the Personnel tile an active production entry without the “В разработке” label. Return from a department invokes `returnToDepartments()` instead of routing to the same component instance.
4. Keep rights aligned with all headers starting at column K, including “Доступ к биркам”, and make employee rows visibly actionable.
5. Publish static bundles atomically with a release marker and verify the deployed route assets. Re-deploy the GAS adapter only after staging smoke tests confirm the right-column schema.

## Safety

- No production spreadsheet sharing, data migration, or deletion is part of this incident fix.
- SQL is a separate migration program: managed PostgreSQL, server API, hashed credentials, audit trail, staged dual-read and rollback. Google Sheets remains the current source until migration tests pass.
- Every production change follows a staging check and a route/login regression checklist.

## Verification

- Automated contracts cover canonical-origin code, profile version migration, Personnel navigation, the active tile, column-K rights, and employee-row affordance.
- Generate/typecheck/lint and the complete Node contract suite run before deployment.
- Browser smoke test: login once, refresh, relaunch from canonical address, navigate Personnel, open a department, return to all departments, and inspect K-right value.
