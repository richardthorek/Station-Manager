# Admin Portal Color Contrast Review (February 10, 2026)

## Scope & Method
- Pages: Admin Station Management and Brigade Access (light theme, default data set).
- Devices: iPad resolutions (landscape 1024×768, portrait 768×1024).
- Verification: WCAG AA contrast checks for updated tokens plus visual inspection in dev build (Playwright).

## Changes Implemented
- Added accessible status tokens to `frontend/src/index.css` (`--surface-error/warning/info/success`, `--text-error-strong`, `--text-warning-strong`, `--text-info-strong`, `--text-success-strong`, `--text-on-amber`) with dark-mode overrides.
- Swapped admin error/info banners and form warnings to the new tokens to eliminate red-on-red and green-on-green pairings.
- Updated amber badges/cards (demo badges, warning headers, amber stat cards) to use high-contrast text on amber backgrounds.

## Screenshots (Before → After)
- Station Management:
  - Before: `images/admin-stations-contrast-before-20260210-landscape.png`, `images/admin-stations-contrast-before-20260210-portrait.png`
  - After: `images/admin-stations-contrast-after-20260210-landscape.png`, `images/admin-stations-contrast-after-20260210-portrait.png`
- Brigade Access:
  - Before: `images/admin-brigade-access-contrast-before-20260210-landscape.png`, `images/admin-brigade-access-contrast-before-20260210-portrait.png`
  - After: `images/admin-brigade-access-contrast-after-20260210-landscape.png`, `images/admin-brigade-access-contrast-after-20260210-portrait.png`

## Outcome
- Admin alerts, warnings, and amber badges now meet AA contrast targets in light and dark modes.
- High-contrast tokens are reusable for future admin surfaces and shared components.
