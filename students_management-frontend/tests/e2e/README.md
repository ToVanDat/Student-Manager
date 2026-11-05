# Responsive Playwright QA

Install the browser test runner locally before executing these tests:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
npx playwright test --config=playwright.config.js
```

For authenticated Student/Admin/Chat coverage, create a Playwright storage-state file using a dedicated non-production test account, then set `PLAYWRIGHT_STORAGE_STATE` to its path. Optional `PLAYWRIGHT_QA_ROUTES` accepts a comma-separated list of authenticated routes. The default routes are `/students?view=dashboard`, `/chat`, and `/settings`.

The current suite checks responsive overflow at 360, 390, 430, 768, and 1365 CSS pixels and checks focus behavior on editable controls. It is a smoke suite, not a substitute for manual menu/modal workflows or real iOS/Android virtual-keyboard testing. Those checks must be completed against the running app with test accounts and the deployed Face pipeline.
