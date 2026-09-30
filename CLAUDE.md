# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo structure

This is a monorepo for **NU Jerseys**, a jersey-design storefront, with two independent apps:

- `frontend/` — Next.js 16 (App Router, React 19) storefront. No `src/` dir; app files live directly under `frontend/app`, `frontend/components`, `frontend/lib`, `frontend/hooks`, `frontend/context`.
- `backend-fastapi/` — Python FastAPI backend (async SQLAlchemy 2.0 + PostgreSQL, Alembic migrations, Razorpay payments, Cloudflare R2 file storage).

The frontend talks exclusively to the FastAPI backend; most flows (checkout, admin, jersey data) will not work with only the frontend running.

## Commands

Run all frontend commands from inside `frontend/` (this is a pnpm project — `pnpm-lock.yaml` is the lockfile, not npm/yarn):

```bash
cd frontend
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm lint
```

Backend (from `backend-fastapi/`, inside its venv):

```bash
cd backend-fastapi
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000        # http://localhost:8000, docs at /docs
```

There is no test suite in either app (no jest/vitest/playwright/pytest configured) — rely on `pnpm lint` and manual verification.

## Gotchas

- **`frontend/proxy.ts`, not `middleware.ts`.** This repo uses Next.js's `proxy.ts` file convention (exporting a `proxy()` function and `config.matcher`) for route protection instead of the traditional `middleware.ts`/`middleware()`. It guards `/admin/*` via the `admin_access_token` cookie. Don't rename it to `middleware.ts` or rename the export — that breaks routing protection.
- **CSP is strict and Razorpay-specific.** `frontend/next.config.ts` sets a detailed Content-Security-Policy allow-listing exactly the domains checkout/analytics/images need (Razorpay, Vercel Analytics, Cloudflare R2, ImageKit). Adding any new third-party script or image host requires updating this CSP explicitly, or it will silently fail in the browser.
- **`frontend/.env` is real and gitignored**, not a `.env.example` — don't print or commit its contents. Required vars: `NEXT_PUBLIC_API_URL` (FastAPI base URL, e.g. `http://localhost:8000/api`), `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Path alias `@/*` maps to `frontend/*` (see `tsconfig.json` / `components.json`).
- UI components follow shadcn/ui ("new-york" style, Tailwind v4, Radix primitives) — check `frontend/components/ui/` for existing primitives before adding new ones.
