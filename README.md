# LCRG / OLC GitHub Pages PWA

This folder is the GitHub Pages frontend for the LCRG / OLC Reporting App.

## Files
- `index.html` – existing reporting interface
- `app-config.js` – Apps Script `/exec` API URL
- `api-shim.js` – compatibility layer that converts existing `google.script.run` calls to HTTP API requests
- `manifest.webmanifest` – installable PWA metadata
- `service-worker.js` – app-shell caching / standalone PWA support
- `icons/` – 192px and 512px app icons

## Apps Script API URL
`https://script.google.com/macros/s/AKfycbxXiJluivDRvmlg_jYleOyuf6g1-k5ahSD9y5Ns8_MlYJtbqh-pW63h-QRA0SHedgXziA/exec`

## Before testing GitHub Pages
1. Deploy the new API-enabled `Code.gs` as a **new Apps Script web-app version**.
2. Use the same `/exec` deployment URL only if that deployment points to the new code.
3. The deployment must be accessible from the GitHub Pages browser session. If Apps Script redirects to a Google sign-in page, the external frontend will not receive JSON.

## GitHub Pages
Upload the contents of this folder to the root of a GitHub repository and enable Pages from the repository branch.
