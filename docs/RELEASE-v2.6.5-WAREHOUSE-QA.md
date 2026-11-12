# MR,KHORASANI v2.6.6 — ZIP-to-APK final QA

Date: 2026-11-12

## Warehouse migration repair
- Added `warehouse-migration.js` and loads it before application startup.
- Normalizes legacy string warehouses to structured records before any `.id` access.
- Preserves warehouse IDs, account codes, metadata, operation references, settings references and opening balances.
- Regression coverage includes string/object records, duplicate IDs, settings, operation references and opening-balance keys.

## Guest security and data retention
- Removed the fixed demo username/password flow from the public `mrk-guest-demo` function.
- Deployed Edge Function `mrk-guest-demo` version 12; JWT verification remains disabled because the function performs its own random session-token validation.
- Each guest session receives a cryptographically random 256-bit token; only its SHA-256 hash is stored.
- Session lifetime is two hours. Session issuance is rate-limited to eight sessions per IP hash per 15 minutes.
- Legacy fixed-password login endpoint now returns HTTP 410.
- `resume`, `heartbeat`, `event`, and `logout` are supported for the current app runtime.
- Guest business state is in-memory only. It is not persisted to localStorage, sessionStorage, IndexedDB, company snapshots, or Supabase.
- Legacy guest working-state keys from previous builds are purged on guest startup.
- Only session start and explicit logout lifecycle records are inserted. Clicks, page views, form values, financial amounts, vouchers and other business actions are not stored.
- The old `mrk-guest-demo-v2` function was inspected and contains no fixed demo password.

## Android ZIP package
- Release: `MR-KHORASANI-v2.6.6-ANDROID-ZIP2APK-FINAL-NO-QR.zip`
- `index.html` is the first/root archive entry.
- QR image and QR references are removed from the Android ZIP.
- ZIP integrity check passed; archive size is approximately 1.2 MB.
- The package is intended for ZIP-to-APK conversion; it is not itself a signed APK.

## Verification
- Node regression tests: 11 passed, 0 failed.
- All inline JavaScript blocks in `index.html` passed `node --check`.
- `app.js`, `guest-runtime.js`, and `warehouse-migration.js` passed syntax checks.
- Static checks confirm no fixed guest password, no QR reference, no guest page/click/business-action event transmission, and no persistent guest business-state writes.

## Remaining release test
The Edge Function deployment and source retrieval are confirmed. The external ZIP-to-APK builder and installation on a physical Android device must still be tested with the resulting APK; no claim is made that a signed APK has already been built or device-tested.
