---
name: dev-up
description: Start both the NU Jerseys frontend (Next.js) and backend (FastAPI) dev servers locally, since most frontend flows (checkout, admin, jersey data) require the backend running. Use when the user asks to "run the app", "start dev servers", or test a change end-to-end.
---

This repo is a monorepo with two apps that normally need to run together.

1. Check whether either server is already running (e.g. port 3000 / 8000 in use) before starting a new one.
2. Start the backend first, in the background, from `backend-fastapi/`:
   - Activate the venv (`.venv\Scripts\activate` on Windows) if not already active.
   - Run `uvicorn app.main:app --reload --port 8000`.
   - Confirm it's up by checking `http://localhost:8000/docs` responds.
3. Start the frontend, in the background, from `frontend/`:
   - Run `pnpm dev`.
   - Confirm it's up by checking `http://localhost:3000` responds.
4. Report both URLs to the user (frontend at http://localhost:3000, backend docs at http://localhost:8000/docs) and leave both processes running in the background rather than blocking.
5. If `frontend/.env` is missing `NEXT_PUBLIC_API_URL` or `backend-fastapi/.env` is missing required vars (DATABASE_URL, SECRET_KEY, RAZORPAY_*, R2_*), stop and tell the user what's missing instead of starting with a broken config.
