# Theme and color tokens

The app supports **light and dark mode** via a toggle in the TopBar. All theme-dependent colors are driven by CSS variables in `src/app/globals.css` and exposed through Tailwind.

## Rules for new UI

- **Use semantic Tailwind classes** so colors respect the active theme:
  - `bg-background`, `bg-card`, `bg-muted`, `bg-primary`
  - `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
  - `border-border`, `bg-header`, `text-header-foreground` (chrome)
- **Avoid** hardcoded scale classes for UI surfaces: no `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*` unless you add explicit `dark:` variants.
- **Brand:** Use `bg-primary` / `text-primary-foreground` for primary actions; `bg-vbt-orange` for accent (both come from CSS vars and adapt in dark mode).
- **Single source of truth:** Change palette only in `globals.css` (`:root` and `.dark`). Tailwind config maps these variables; do not add hex colors for UI in `tailwind.config.ts`.

## Toggle and persistence

- Theme is persisted in cookie `NEXT_THEME` (light | dark).
- `ThemeProvider` and `useTheme()` live in `src/lib/theme.tsx`.
- An inline script in the root layout applies the theme class before paint to avoid flash.
