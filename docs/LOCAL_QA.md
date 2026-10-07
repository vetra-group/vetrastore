# Local browser quality checks

## Automated browser regression

```powershell
npm run build
npm run test:browser
```

This starts an isolated loopback preview and a fresh headless Chrome/Edge
profile. It clears provider configuration, uses temporary server data, and
does not edit the working store or use your normal browser profile. Set
`BROWSER_EXECUTABLE` if the installed browser is in a different location.
No extra browser automation dependency is required.

The suite covers navigation and focus, URL filters/pagination, draft and image
recovery after reload, concurrent edit decisions, publication, deferred article
loading, public-to-staff enquiries across two independent profiles, simulated
notification receipts, and responsive overflow. Reports and screenshots are
written to `output/qa/browser-regression`; CI retains them even on failure.
It tests CSS layout widths, not physical displays, OS scaling, or actual
browser zoom. Native folder-picker permissions remain a manual acceptance
check; `test:backups` uses in-memory folder handles and `test:release` exercises
the real CLI against disposable files and an isolated server.

## Storefront interaction and accessibility regression

```powershell
npm run build
npm run test:storefront
```

This separate isolated suite checks the mini-cart, Undo, live search, gallery
loading/swipes/zoom, contact/checkout validation and opt-in recovery in English,
Arabic and Thai. It also launches disposable Chromium profiles with actual 200% and
400% browser zoom and a 32px default font preference. The test asserts that
browser zoom changes the CSS viewport and pixel ratio, and that the root font
follows the browser preference. It does not inject CSS to simulate these
settings. Normal responsive checks verify the prescribed root scale through
7680 CSS px. Reports/screenshots are in `output/qa/storefront-polish`.

Physical touch devices, operating-system scaling, other browser engines and
native assistive technology still need separate acceptance. The contact save
uses fictional data and the isolated local mock; it sends no external message.

Customer form recovery is opt-in, per form/language and expires after 24 hours.
It excludes consent and payment details. Confirmed success or explicit removal
clears the saved copy; failed submissions retain entered values and the same
opaque retry identity. CMS recovery below has its own scope and lifetime.

For a reproducible first-load sample with disabled HTTP cache, 150ms latency
and 400KB/s download:

```powershell
node scripts/check-storefront-performance.mjs http://127.0.0.1:3100 after
```

Local fonts are included in this throttle. There is no CPU throttle; this is a
small local lab sample, not field Core Web Vitals. Keep before/after conditions
and available fonts comparable before claiming a speed improvement.

## CMS draft and image recovery acceptance

1. In CMS, edit text without saving. Wait for the browser recovery status,
   reload the same tab, choose **Recover work**, inspect, then save.
2. Change the same field from another staff session. Saving the older editor
   must preserve its input and offer per-field choices when merging.
3. Prepare an image and descriptions, reload, and choose **Recover image**.
   No image should upload before **Save image**. After an interrupted upload
   or save, the CMS checks the saved submission before retrying.
4. Check narrow screens, keyboard focus, validation errors, and all three languages.

Recovery copies live in this browser's IndexedDB for up to seven days and are
scoped to the account and tab. Successful saves remove the corresponding draft
checkpoint; explicit logout removes this tab's text/image checkpoint. Browser
storage deletion, private browsing, quota errors, or closing a tab without a
restorable session can remove recovery data. These copies are not backups.
Discarding an image recovery copy does not delete server media; authorized
**Cleanup** handles confirmed unreferenced uploads.

## Optional manual diagnostics

Use a production build and loopback preview. The optional diagnostics panel is
disabled by default and is never enabled by a public environment variable.

```powershell
npm run build
$env:LOCAL_AUDIT='true'
npm run start -- --hostname 127.0.0.1 --port 3100
```

Visit `/?audit=1`, `/ar?audit=1` or `/th?audit=1`. Open **Local quality checks** after the initial
page has loaded and select **Capture local report**. The panel uses native
PerformanceObserver entries. It does not transmit or persist measurements.
Restart the preview without `LOCAL_AUDIT` when finished.

## Constrained connection

In a separate terminal:

```powershell
npm run audit:serve -- http://127.0.0.1:3100
```

Visit `http://127.0.0.1:3320/?audit=1`. This GET-only loopback proxy adds 150ms
per request and shares 200,000 bytes/second across local responses. It blocks
administrative routes and mutations, strips credentials and disables caching.
Stop it with Ctrl+C. `AUDIT_PORT`, `AUDIT_LATENCY_MS` and
`AUDIT_BYTES_PER_SECOND` configure bounded alternatives.

The proxy does **not** throttle CPU. Fonts are now self-hosted and pass through
the same local proxy. Cache state, image optimization, machine load and timing
affect results. Compare the same route, viewport and conditions. A sample is not field
Core Web Vitals or a slow-phone benchmark. The interaction measurement is the
longest observed Event Timing duration, **not a complete INP measurement**.
Capture after representative actions; a null value means no measured event.

## Larger text and actual browser settings

The panel can temporarily set a 20, 24 or 32px rem baseline. This is a layout
stress test, explicitly **not** actual browser zoom or font-preference testing.
Reloading restores the normal browser-derived baseline and prescribed root
scaling. Check visible actions and text as well as document overflow.

For real browser acceptance, use a browser whose zoom and appearance settings
are available and restore those settings afterwards:

1. At a normal desktop window, test 200% and 400% browser zoom. Check the header,
   mobile menu, search, product purchase controls, checkout and CMS drawer.
2. Separately increase the browser's default font size to 32px. Check that text
   can grow without clipping, lost buttons or unintended two-direction scrolling.
3. Use Tab, Shift+Tab, Enter and Escape through navigation, dialogs, slider,
   forms and CMS. Check visible focus and focus restoration.
4. Enable the operating system's reduced-motion preference. Confirm the slider
   stops autoplay and drawers/scrolling avoid movement. Restore the preference.

The available in-app browser exposes viewport resizing but not real zoom,
font-preference or reduced-motion emulation. Those actual-setting checks remain
unverified until completed in a suitable browser. Viewport resizing and the
panel's text simulation must not be reported as equivalent tests.

Reference: [W3C text resizing](https://www.w3.org/WAI/WCAG21/Understanding/resize-text)
and [reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow).

## Release checks

Run `npm run test:release -- --expected-site-url=http://127.0.0.1:3100` after the
build, matching the build's configured site URL. See [production setup](PRODUCTION_SETUP.md)
for isolation, staging and external-provider boundaries, [QA](QA.md) for measured
results, and [all 21 tasks](TASK_STATUS.md) for remaining owner inputs.
