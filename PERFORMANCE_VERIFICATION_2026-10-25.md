# Performance verification — 25 October 2026

Active project: `G:\LabTrack - QR\app`. The original chat folder contains `PROJECT_MOVED.txt` pointing here. The checkout already contained substantial work in progress; those changes were preserved. This performance task did not publish a release, apply hosted migrations, or mutate laboratory records.

## Causes and changes

- Inventory and history used native GET forms, replacing the document on every search. They now use Next.js `Form`, keeping the shared application shell and using pending submit feedback. Filter URLs, hidden status/category inputs, browser back navigation, exports, and the no-JavaScript form fallback are retained.
- Scanner pages eagerly imported the camera/image QR decoder even for typed and USB scanner input. The decoder now loads on demand for camera or image use. Camera startup has a pending state and retains duplicate-start protection and stale-camera cleanup.
- Return identification performed a borrower lookup followed by a separate custody API request, repeating authentication and profile work. `/api/custody` now accepts a typed Student ID or student QR and returns identity plus custody together. Token-based refreshes remain supported. Authorization, ambiguity checks, escaping of wildcard characters, missing-tool recovery, and exact reviewed item IDs are preserved.
- Full history reports requested an exact matching count for every export batch. Counts are now requested only for the paginated screen. Related-item queries overlap at most four independent batches while fully paginating each batch and rejecting incomplete reads.
- Grouping history items repeatedly copied arrays, and the borrowed-tools table searched all transactions for each item. These use incremental groups and an ID map.
- Server-rendered pages reuse a Supabase client within a single React render. This is request-scoped, with no shared user/session cache.
- Dismissing a user-management notification previously triggered another server navigation and data load. It now removes only the notification query parameters using Next.js-supported browser history integration.
- Navigation links show a pending indicator inside their existing padding, without narrowing the labels or changing the menu layout.

## Measured evidence

Raw before/after measurements and the read-only measurement script are under `output/performance/`. Measurements use local production servers, Chromium, and the existing remote Supabase backend with shared demo sign-in. Timings are individual observations, not statistically established production latency guarantees.

Baseline versus final build:

| Operation | Before | After |
| --- | ---: | ---: |
| Navigate to Borrow Tools | 867 ms | 380 ms |
| Navigate to Process Return | 867 ms | 356 ms |
| Identify borrower and load return custody | 1,945 ms | 1,409 ms |
| Inventory search | 887 ms | 827 ms |
| Search retains the document | No | Yes |
| JavaScript transferred along login → inventory → history → borrow | 282,888 bytes | 159,237 bytes |

The JavaScript transfer reduction was approximately 44%, using `PerformanceResourceTiming.encodedBodySize`. The deferred decoder chunk contains 478,737 bytes of minified JavaScript before HTTP compression. Browser tests separately verify that the decoder implementation is absent from typed-scan downloads and that an actual exported tool label still decodes after image upload.

Inventory navigation measured 0.91 seconds and history 0.90 seconds in the final run. History varied between 0.90 and 1.41 seconds across the two optimized runs; sign-in varied between 2.58 and 4.07 seconds. These observations demonstrate network/cache variability and do not support a blanket latency guarantee. The changes remove unnecessary work and improve responsiveness while retaining fresh authenticated reads.

## Verification

- PASS: full ESLint check.
- PASS: TypeScript check.
- PASS: 407 unit tests in 43 files.
- PASS: optimized production build, with all existing application routes present.
- PASS: isolated PostgreSQL migration/workflow suite: complete and partial returns, damaged and missing items, recovery, role/scope isolation, temporary passwords, MFA, concurrent checkout/return/missing operations, account-security races, and fictional backup restoration.
- PASS: desktop and mobile browser checks for custodian, instructor, and student routes; responsive widths of 320, 390, 768, and 1366 pixels; inventory/transaction CSV and printable report agreement; QR downloads; protected routes; menus; refresh; and logout.
- PASS: inventory/history searches preserve the document, query filters, export links, and browser history; dismissing a notification sends no replacement users request.
- PASS: typed scanning excludes the decoder download; an actual downloaded tool QR label, rasterized as PNG, loads the decoder and populates checkout review. Remove/change controls remain usable. No checkout is submitted by this read-only browser test.

The first image regression test generated a separate QR using different error-correction/raster settings; that particular raster also failed the standalone decoder. The test was corrected to exercise the actual SVG downloaded from the app. The four focused desktop/mobile performance tests then passed. The application decoder was not weakened or replaced to accommodate the fixture.

Final recheck after the menu-layout adjustment: TypeScript, focused ESLint, and the production rebuild passed. The desktop/mobile navigation and performance suite passed 8 checks with 4 expected layout-specific skips, zero failures, and zero flaky cases. Together with the broader role/public/report checks, all 28 applicable distinct browser scenarios passed after correcting the image fixture. The final measurement recorded zero browser page errors. Final desktop and mobile-menu screenshots were visually inspected.

Final local build ID: `-7Y0f-8bc3MILGmx8yH7d`. Evidence: `output/performance/before.json`, `after.json`, `final.json`, `browser-final.json`, `verification.json`, `final-desktop.png`, and `final-mobile-menu.png`. `after.json` preserves the initial optimized run; `final.json` is the final-build measurement used in the table. The local preview runs at `http://localhost:3001/login` while its server remains running.

## Boundaries

- No Git commit, push, or Vercel deployment was performed by this task. These are local application changes.
- Browser reads used existing shared demo records. Mutating workflow verification used a separate loopback PostgreSQL database, not the hosted laboratory database.
- Physical phone camera, USB scanner hardware, printed labels, and client/adviser acceptance were not tested.
- Remote database/authentication latency, hosting region, and production load remain outside the local timing proof. No paid service or dependency was added.

Framework references: [Next.js Form](https://nextjs.org/docs/app/api-reference/components/form), [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading). Implementation was also checked against the documentation shipped with this repository's installed Next.js version.
