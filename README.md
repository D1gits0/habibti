# Compound — Habit & Project Tracker

A retro-RPG themed full-stack habit/project tracker.

## Quick Start

### Backend (FastAPI + SQLite)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `localhost:8000`.

### iOS Homescreen

Open the app in Safari, tap Share → Add to Home Screen. The manifest enables standalone fullscreen mode.

## Pages

1. **Quests** — Threads/projects board (kanban on desktop, collapsible on mobile)
2. **Log** — Quick entry form for gym, sleep, hydration, habit data
3. **Gym** — Charts + table filtered to gym category
4. **Habits** — 30-day habit overview with XP bars and mini charts
