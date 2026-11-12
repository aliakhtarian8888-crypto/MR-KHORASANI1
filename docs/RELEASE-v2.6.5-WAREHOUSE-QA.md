# MR,KHORASANI v2.6.5 — Warehouse migration QA

Date: 2026-11-12

## Defect reproduced

Legacy saved state may contain warehouse entries as strings (for example, `"انبار شماره یک"`). The previous migration attempted to assign `id` directly to every entry and failed with:

`TypeError: Cannot create property 'id' on string 'انبار شماره یک'`

This interrupted startup before the main application UI rendered.

## Repair in the release ZIP

The v2.6.5 ZIPs include a normalization step before `settingsOf(S)` and before any access to `warehouse.id`. It:

- converts legacy string entries to records with stable IDs, names, and warehouse account codes;
- preserves existing warehouse IDs, account codes, and extra metadata when records are already objects;
- remaps warehouse references in operation records, settings, nested rows, and goods opening balances;
- assigns a non-conflicting account code for unknown legacy warehouse names;
- avoids adding duplicate standard warehouses where a legacy record already has the same normalized name.

## Verification

Node regression suite: 12 passed, 0 failed.

JavaScript syntax checks: `app.js` and inline scripts in `index.html` passed.

Manifest checks: `manifest.json` and `manifest.webmanifest` parsed successfully.

ZIP checks: both release archives pass ZIP integrity checks; `index.html` is the first entry.

## Separate APK inspection

The uploaded `COOKIEP-1.0.apk` is not an APK built from the supplied v2.6.4 ZIP. Its wrapper configuration reports app name `COOKIEP`, package `com.app.cookiep`, version `1.0`, and embedded web source directory `MR-KHORASANI-v2.6.0-AUTH-CLOUD-SYNC`.

## Known guest integration blocker

The deployed `mrk-guest-demo` v11 and `mrk-guest-demo-v2` v2 APIs do not match the current `guest-runtime.js` request contract (`resume`, `heartbeat`, `event`, `logout`, and `x-guest-session`). The current server demo also uses a fixed test password, not a fresh per-scan OTP. Do not treat the full-app guest flow as production-ready until the Edge Function and hosted web entry point are aligned and tested end-to-end.

The release ZIPs are available from the ChatGPT conversation; this repository branch currently contains this QA record, not the binary ZIP archives or full app source tree.
