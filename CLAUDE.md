# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev      # Start development server at localhost:3000
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## Stack

- **Next.js 16** with the App Router (`app/` directory)
- **React 19**
- **TypeScript** (strict mode, `moduleResolution: bundler`)
- **Tailwind CSS v4** — configured via `@tailwindcss/postcss` (no `tailwind.config.js`; uses `@theme` in `globals.css`)
- **pnpm** as the package manager

## Architecture

This is an early-stage project. All routes live under `app/` following Next.js App Router conventions:

- `app/layout.tsx` — root layout with Geist/Geist_Mono fonts and global CSS
- `app/page.tsx` — home route (`/`)
- `app/globals.css` — global styles with Tailwind import and CSS variable theming

**Path alias:** `@/*` maps to the project root (e.g. `import foo from "@/app/components/foo"`).

**CSS theming:** Colors use CSS variables (`--background`, `--foreground`) defined in `globals.css` with automatic dark mode via `prefers-color-scheme`. Tailwind theme tokens are wired up via `@theme inline` block.

**ESLint:** Uses `eslint-config-next/core-web-vitals` + TypeScript rules (ESLint v9 flat config in `eslint.config.mjs`).
