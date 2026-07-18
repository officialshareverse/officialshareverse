ACTION 10 — CSS CONSOLIDATION
================================================================================

------------------------------------------------------------------------
10.1  Add stylelint config
------------------------------------------------------------------------
File: frontend/.stylelintrc.json (NEW)

```json
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "declaration-no-important": true,
    "color-no-hex": true,
    "color-named": ["never", { "ignore": ["inside-function"] }],
    "max-nesting-depth": 3,
    "selector-max-id": 0,
    "no-duplicate-selectors": true,
    "no-descending-specificity": true,
    "color-function-notation": null,
    "alpha-value-notation": null,
    "media-feature-range-notation": null,
    "at-rule-no-unknown": null,
    "import-notation": null,
    "selector-class-pattern": null,
    "custom-property-empty-line-before": null,
    "property-no-vendor-prefix": null,
    "value-no-vendor-prefix": null,
    "media-feature-name-no-unknown": null,
    "keyframes-name-pattern": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "shorthand-property-no-redundant-values": null,
    "comment-empty-line-before": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "no-empty-first-line": null,
    "string-quotes": null
  }
}
```

File: frontend/.stylelintignore (NEW)

```
# A10 fix: stylelint is a GOAL-state config. The existing codebase has
# ~55 !important + ~81 hardcoded hex colors; cleanup is gradual. These
# files are excluded until cleaned.
src/styles/CreateGroup_redesign.css
src/styles/motion.css
src/styles/components-01.css
src/styles/components-02.css
src/styles/components-03.css
src/styles/components-04.css
src/styles/base.css
src/styles/dark-tokens.css
src/styles/create-group.css
src/styles/home.css
src/styles/explore.css
src/styles/account.css
```

Add to frontend/package.json scripts:
    "lint:css": "stylelint \"src/styles/**/*.css\""

Add to frontend/package.json devDependencies:
    "stylelint": "^16.10.0",
    "stylelint-config-standard": "^36.0.1"

------------------------------------------------------------------------
10.2  Fix duplicated dark-mode in base.css
------------------------------------------------------------------------
File: frontend/src/styles/base.css

Create frontend/src/styles/dark-tokens.css (NEW) — single source of truth
for dark token VALUES:

```css
/* A10 fix (C3): dark token values defined ONCE here.
   base.css's body.sv-dark and @media (prefers-color-scheme: dark) blocks
   both map the standard --sv-* property names to these --sv-dark-* values.
   CSS has no native way to share a property list between a top-level
   selector and a @media-wrapped selector, so the MAPPING list is
   intentionally duplicated in base.css while the VALUES are centralized
   here.
   TODO: add a synchronous theme-init script to public/index.html so the
   @media block can be deleted entirely (the script reads localStorage
   and applies body.sv-dark before first paint). */

:root {
  --sv-dark-bg: #0c0f14;
  --sv-dark-bg-soft: #11161f;
  --sv-dark-paper: rgba(22, 27, 38, 0.82);
  --sv-dark-paper-solid: #161b26;
  --sv-dark-ink: #e2e8f0;
  --sv-dark-muted: #94a3b8;
  --sv-dark-accent: #2dd4bf;
  --sv-dark-accent-secondary: #a78bfa;
  --sv-dark-accent-soft: rgba(45, 212, 191, 0.14);
  --sv-dark-border: rgba(148, 163, 184, 0.12);
  --sv-dark-success: #34d399;
  --sv-dark-danger: #fb7185;
  --sv-dark-warning: #fbbf24;
  --sv-dark-shadow: 0 28px 80px rgba(2, 6, 23, 0.4);
  --sv-dark-body-radial-a: rgba(45, 212, 191, 0.12);
  --sv-dark-body-radial-b: rgba(124, 58, 237, 0.16);
  --sv-dark-page-radial-a: rgba(45, 212, 191, 0.08);
  --sv-dark-page-radial-b: rgba(124, 58, 237, 0.1);
  --sv-dark-brand-shell-bg: rgba(15, 23, 42, 0.74);
  --sv-dark-soft-surface: rgba(19, 27, 39, 0.78);
  --sv-dark-elevated-surface: rgba(15, 23, 42, 0.9);
  --sv-dark-input-surface: rgba(15, 23, 42, 0.92);
}
```

In base.css, replace the duplicated dark token values in BOTH
`body.sv-dark { }` and `@media (prefers-color-scheme: dark) {
body:not(.sv-light) { } }` blocks with references to the --sv-dark-*
tokens. Example:

```css
@import "./dark-tokens.css";

body.sv-dark {
  --sv-bg: var(--sv-dark-bg);
  --sv-bg-soft: var(--sv-dark-bg-soft);
  --sv-paper: var(--sv-dark-paper);
  --sv-paper-solid: var(--sv-dark-paper-solid);
  --sv-ink: var(--sv-dark-ink);
  --sv-muted: var(--sv-dark-muted);
  --sv-accent: var(--sv-dark-accent);
  --sv-accent-secondary: var(--sv-dark-accent-secondary);
  --sv-accent-soft: var(--sv-dark-accent-soft);
  --sv-border: var(--sv-dark-border);
  --sv-success: var(--sv-dark-success);
  --sv-danger: var(--sv-dark-danger);
  --sv-warning: var(--sv-dark-warning);
  --sv-shadow: var(--sv-dark-shadow);
  --sv-body-radial-a: var(--sv-dark-body-radial-a);
  --sv-body-radial-b: var(--sv-dark-body-radial-b);
  --sv-page-radial-a: var(--sv-dark-page-radial-a);
  --sv-page-radial-b: var(--sv-dark-page-radial-b);
  --sv-brand-shell-bg: var(--sv-dark-brand-shell-bg);
  --sv-soft-surface: var(--sv-dark-soft-surface);
  --sv-elevated-surface: var(--sv-dark-elevated-surface);
  --sv-input-surface: var(--sv-dark-input-surface);
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  body:not(.sv-light) {
    /* Same mapping as body.sv-dark above. The VALUES are centralized in
       dark-tokens.css; only the property-name -> token MAPPING is
       duplicated here because CSS can't share it across @media. */
    --sv-bg: var(--sv-dark-bg);
    --sv-bg-soft: var(--sv-dark-bg-soft);
    /* ... (identical mapping) ... */
    color-scheme: dark;
  }
}
```

------------------------------------------------------------------------
10.3  Split components-05.css
------------------------------------------------------------------------
File: frontend/src/styles/components-05.css (DELETE)

Read it in chunks (it's ~4400 lines). Identify sections by class-name
prefixes (.sv-cg-* = CreateGroup, .sv-wallet-*, .sv-my-shared-*, etc.)
or comment headers.

Split into:
  - src/styles/create-group.css   (~1871 lines)
  - src/styles/ui-primitives.css  (~326 lines)
  - src/styles/home.css           (~1188 lines)
  - src/styles/account.css        (~441 lines)
  - src/styles/explore.css        (~528 lines)
  - src/styles/profile.css        (~103 lines)
  - src/styles/a11y.css           (~22 lines)

Update frontend/src/index.css to import the new files instead of
components-05.css:

```css
@import "./styles/base.css";
@import "./styles/dark-tokens.css";
@import "./styles/components-01.css";
@import "./styles/components-02.css";
@import "./styles/components-03.css";
@import "./styles/components-04.css";
/* A10 fix: components-05.css split into 7 files below */
@import "./styles/create-group.css";
@import "./styles/ui-primitives.css";
@import "./styles/home.css";
@import "./styles/account.css";
@import "./styles/explore.css";
@import "./styles/profile.css";
@import "./styles/a11y.css";
@import "./styles/CreateGroup_redesign.css";
@import "./styles/motion.css";
@import "./styles/my-shared.css";
```

Fix any pre-existing CSS syntax errors discovered during the split
(unclosed comments, orphaned */).

------------------------------------------------------------------------
10.4  Replace hardcoded hex with CSS vars
------------------------------------------------------------------------
Files: all src/styles/components-*.css (the ones NOT in .stylelintignore)

Use the var(--sv-*) tokens from base.css. Top replacements:

  #ffffff (62x) -> var(--sv-paper-solid) (or #fff for button bg)
  #0f766e (59x) -> var(--sv-accent)
  #0f172a (31x) -> var(--sv-ink-strong)  # NEW TOKEN — add to base.css :root
  #b45309 (28x) -> var(--sv-warning-strong)  # NEW TOKEN
  #2dd4bf (28x) -> var(--sv-accent-light)  # NEW TOKEN
  #7c3aed (24x) -> var(--sv-accent-secondary)

Add to base.css :root:

    /* A10 fix: new tokens to replace hardcoded hex. */
    --sv-accent-light: #2dd4bf;
    --sv-ink-strong: #0f172a;
    --sv-warning-strong: #b45309;
    --sv-on-accent: #ffffff;

DO NOT change brand colors in motion.css (Netflix #e50914, Spotify
#15803d, etc.) — add a comment explaining why they stay hardcoded.

------------------------------------------------------------------------
10.5  Convert mySharedUi.js inline styles to CSS classes
------------------------------------------------------------------------
File: frontend/src/pages/mySharedUi.js
File: frontend/src/pages/MyShared.js
File: frontend/src/styles/my-shared.css (NEW)

Strategy: migrate the TOP 20 most-used style objects from mySharedUi.js
to .sv-ms-* classes in my-shared.css. Leave the remaining ~65 with a
TODO comment.

For each migrated object:
  - Create a CSS class with the equivalent properties.
  - For mobile variants (summaryCardMobile), use a @media (max-width: 767px)
    override OR a .is-mobile parent class.
  - Update MyShared.js call sites from
    `style={{ ...summaryCard, ...summaryCardMobile }}` to
    `className="sv-ms-summary-card"`.
  - Remove the now-unused import from MyShared.js.

Class naming pattern: convert camelCase object name to kebab-case with
`sv-ms-` prefix. E.g. `summaryCard` -> `.sv-ms-summary-card`,
`filterButton` -> `.sv-ms-filter-button`, `metricBlock` ->
`.sv-ms-metric-block`, `factPill` -> `.sv-ms-fact-pill`,
`starRow` -> `.sv-ms-star-row`.

Add a TODO banner at the top of mySharedUi.js:

    /*
     * A10 fix (partial): ~20 of ~85 style objects below have been migrated
     * to .sv-ms-* classes in src/styles/my-shared.css. The remaining ~65
     * are still in this file. Migrate in batches of ~20 per PR following
     * the same pattern:
     *   1. Add the equivalent .sv-ms-* class to my-shared.css.
     *   2. Update MyShared.js call sites to use className instead of style.
     *   3. Remove the export from this file.
     * Next priorities: summaryCard, filterButton, metricBlock, factPill,
     * starRow, hero, cardMobile, sectionHeader families.
     */

================================================================================
NOTES FOR GEMINI 3.1 PRO
================================================================================

1. MIGRATION ORDER: Apply in dependency order 0040 -> 0042 -> 0043 -> 0041
   (filenames don't match dependency order due to parallel creation; Django
   handles this via the `dependencies` field).

2. SECRET ROTATION: Before deploying Action 3, generate a fresh
   CREDENTIAL_ENCRYPTION_KEY in the Render dashboard (sync:false,
   Persistent). Run `python manage.py rotate_encryption_key --dry-run`
   after deploy to verify, then run without --dry-run to migrate existing
   ciphertexts.

3. RAZORPAY SRI HASH: Action 6.2 leaves RAZORPAY_CHECKOUT_SRI empty as a
   placeholder. Fetch the real hash before merging:
     curl -s https://checkout.razorpay.com/v1/checkout.js | \
       openssl dgst -sha384 -binary | openssl base64 -A
   Prepend "sha384-" and paste into the constant.

4. RAZORPAY WEBHOOK IPs: Action 4.6 leaves DEFAULT_RAZORPAY_WEBHOOK_ALLOWED_IPS
   as placeholders. Fetch the current published list from
   https://razorpay.com/docs/webhooks/ and replace.

5. CI SECRETS: Add CI_DJANGO_SECRET_KEY and CI_CREDENTIAL_ENCRYPTION_KEY
   as GitHub Actions secrets (different from production values).

6. STYLELINT: The config is a GOAL state. The .stylelintignored files
   still have ~55 !important + ~476 hardcoded hex colors. Clean up
   gradually per PR.

7. FOLLOW-UPS (not in this spec, documented in worklog):
   - settings.py: assert DJANGO_REDIS_URL.startswith("rediss://") in prod
   - render.yaml: add AWS_STORAGE_BUCKET_NAME + AWS_ACCESS_KEY_ID +
     AWS_SECRET_ACCESS_KEY + AWS_S3_REGION_NAME env vars (sync:false)
   - render.yaml: create frontend/public/_headers with HSTS + CSP
   - mobile: wire authError retry banner in RootNavigator.js
   - mobile: gate handleUnauthorizedSession on 401-only in client.js
   - frontend: add CSP meta tag to public/index.html
   - frontend: continue mySharedUi.js migration (~65 objects remaining)
   - mobile: migrate to TypeScript (entire app is .js)
   - Create RUNBOOK.md with Postgres restore-test + cron lock procedures

8. After all changes: run `python manage.py makemigrations --check --dry-run`
   to verify no migration drift, then `python manage.py migrate` to apply.
   Run `python manage.py test core core.tests_security` to verify backend.
   Run `npm test -- --watchAll=false` in frontend to verify web.

9. Commit message suggestion:
   "fix: Top 10 critical/high-priority ShareVerse fixes (payment bugs,
   auth, encryption, security, infra, CI, frontend perf, CSS)"

10. Push to a feature branch and open a PR; do NOT push directly to main.
    The CI workflow (Action 8) will run ruff + pip-audit + eslint +
    npm-audit + gitleaks + trivy + CodeQL on the PR.

================================================================================
END OF SPEC
================================================================================
