# PulseDesk — Production Deployment & CI/CD Guide (Containerless)

This document provides complete instructions for deploying and maintaining PulseDesk across **Render**, **Supabase**, **Vercel**, and **GitHub Actions** without Docker.

---

## 1. Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Vercel (React + Vite)   │
                          │   https://app.example.com │
                          └─────────────┬─────────────┘
                                        │ HTTPS / WSS
                                        ▼
                          ┌───────────────────────────┐
                          │   Render Web Service      │
                          │   (Daphne ASGI + Channels)│
                          │   https://api.example.com │
                          └──────┬─────────────┬──────┘
                                 │             │
        Internal Redis           │             │ PostgreSQL (SSL)
        ┌────────────────────────┼────────┐    │
        │                        │        │    ▼
        ▼                        ▼        │ ┌─────────────────────────┐
┌───────────────┐        ┌──────────────┐ │ │ Supabase PostgreSQL     │
│ Render Worker │        │ Render Beat  │ │ │ (Port 5432 for session/ │
│ (Celery)      │        │ (Scheduler)  │ │ │ migrations; 6543 pool)  │
└───────────────┘        └──────────────┘ │ └─────────────────────────┘
        ▲                        ▲        │
        │                        │        │
        └────────────────────────┴────────┘
```

| Service Component | Target Platform | Type / Runtime | Notes |
|---|---|---|---|
| **API & WebSockets** | Render | Python (Daphne ASGI) | Serves HTTP REST API and Channels WebSocket routes |
| **Celery Worker** | Render | Python Background Worker | Processes asynchronous jobs (emails, escalations, SLAs) |
| **Celery Beat** | Render | Python Background Worker | Dispatches periodic SLA monitoring and keep-alive pings |
| **Redis Broker** | Render | Managed Redis | Serves as Celery broker/result backend and Channel layer |
| **Database** | Supabase | Managed PostgreSQL | Tenant data, users, and audit logs |
| **Frontend** | Vercel | Static / SPA | React + Vite + TypeScript with client-side rewrites |
| **CI Automation** | GitHub Actions | Ubuntu / Node 22 / Python 3.12 | Automated checks, linting, and tests |

---

## 2. Supabase PostgreSQL Configuration

1. Create a project in [Supabase](https://supabase.com).
2. Go to **Project Settings > Database**.
3. Under **Connection string**, note:
   - **Direct Connection / Session Pooler (Port 5432)**:
     `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
     *(Recommended for Render web service to allow transactional DDL migrations without PgBouncer statement timeouts).*
   - **Transaction Mode Pooler (Port 6543)**:
     `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
     *(Note: If used for migrations, PgBouncer may drop connections during complex schema changes. Use port 5432 for `render-build.sh` migrations).*
4. The backend settings automatically apply `sslmode=require`.

---

## 3. Render Deployment (Backend, Celery & Redis)

### Option A: Using Render Blueprints (Recommended)

1. Push this repository to your GitHub account.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New > Blueprint**.
3. Connect your repository. Render will automatically parse [render.yaml](file:///home/alex/Documents/ProjectCatagory/pulsedesk/render.yaml).
4. Render will prompt you for the un-synced environment variables:
   - `DB_URL`: Your Supabase connection string.
   - `ALLOWED_HOSTS`: `pulsedesk-backend.onrender.com` (and your custom domain if applicable).
   - `CORS_ALLOWED_ORIGINS`: Your Vercel frontend URL, e.g. `https://pulsedesk.vercel.app`.
   - `CSRF_TRUSTED_ORIGINS`: `https://pulsedesk-backend.onrender.com,https://pulsedesk.vercel.app`.
   - `FRONTEND_URL`: `https://pulsedesk.vercel.app`.
   - `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`: SMTP credentials.
5. Click **Apply**. Render will create:
   - `pulsedesk-redis` (Managed Redis)
   - `pulsedesk-backend` (Web Service with `render-build.sh` build script)
   - `pulsedesk-worker` (Background Worker)
   - `pulsedesk-beat` (Background Worker)

### Option B: Manual Configuration on Render

If configuring services manually:

#### 1. Redis (`pulsedesk-redis`)
- **Type**: Redis
- **Name**: `pulsedesk-redis`
- **Plan**: Free or Starter
- Copy the **Internal Redis URL** (`redis://red-...:6379`).

#### 2. Django Web Service (`pulsedesk-backend`)
- **Type**: Web Service
- **Runtime**: Python 3
- **Build Command**: `./render-build.sh`
- **Start Command**: `cd backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application`
- **Health Check Path**: `/api/v1/health/`
- **Environment Variables**: See Environment Variables Matrix below.

#### 3. Celery Worker (`pulsedesk-worker`)
- **Type**: Background Worker
- **Runtime**: Python 3
- **Build Command**: `pip install -r backend/requirements/production.txt`
- **Start Command**: `cd backend && celery -A config worker --loglevel=INFO`
- **Environment Variables**: Same `DB_URL`, `CELERY_BROKER_URL`, `SECRET_KEY`, and email settings as backend.

#### 4. Celery Beat (`pulsedesk-beat`)
- **Type**: Background Worker
- **Runtime**: Python 3
- **Build Command**: `pip install -r backend/requirements/production.txt`
- **Start Command**: `cd backend && celery -A config beat --loglevel=INFO`
- **Environment Variables**: Same `DB_URL`, `CELERY_BROKER_URL`, and `SECRET_KEY` as worker.

---

## 4. Vercel Deployment (Frontend)

1. In the [Vercel Dashboard](https://vercel.com), click **Add New > Project**.
2. Select your `pulsedesk` GitHub repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`
   - **Build Command**: `npm run build` (or leave default `tsc -b && vite build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add Environment Variables:
   - `VITE_API_BASE_URL`: `https://pulsedesk-backend.onrender.com`
   - `VITE_WS_BASE_URL`: `wss://pulsedesk-backend.onrender.com`
   - `VITE_APP_NAME`: `PulseDesk`
   - `VITE_APP_VERSION`: `1.0.0`
   - `VITE_ENABLE_WEBSOCKETS`: `true`
   - `VITE_ENABLE_ANALYTICS`: `false`
5. Click **Deploy**.
6. Note: SPA client-side routing is handled automatically by [frontend/vercel.json](file:///home/alex/Documents/ProjectCatagory/pulsedesk/frontend/vercel.json).

---

## 5. Environment Variables Reference

### Backend (`pulsedesk-backend`, `pulsedesk-worker`, `pulsedesk-beat`)

| Variable | Required In | Description | Example |
|---|---|---|---|
| `DJANGO_SETTINGS_MODULE` | All | Django settings module | `config.settings.production` |
| `SECRET_KEY` | All | Cryptographic signing key | `django-insecure-prod-key-xyz...` |
| `DB_URL` | All | Supabase PostgreSQL connection string | `postgresql://user:pass@db.ref.supabase.co:5432/postgres` |
| `CELERY_BROKER_URL` | All | Redis broker URL | `redis://red-xxxx:6379` |
| `CELERY_RESULT_BACKEND`| All | Redis result backend | `redis://red-xxxx:6379` |
| `CHANNEL_REDIS_URL` | Web | Channels Redis layer URL | `redis://red-xxxx:6379` |
| `ALLOWED_HOSTS` | Web | Comma-separated list of allowed hostnames | `pulsedesk-backend.onrender.com,api.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | Web | Allowed frontend origins | `https://pulsedesk.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | Web | Trusted origins for CSRF checks | `https://pulsedesk-backend.onrender.com,https://pulsedesk.vercel.app` |
| `FRONTEND_URL` | Web | Base URL for password reset and verify emails | `https://pulsedesk.vercel.app` |
| `EMAIL_HOST` | Web, Worker | SMTP server hostname | `smtp.sendgrid.net` or `smtp.gmail.com` |
| `EMAIL_PORT` | Web, Worker | SMTP port | `587` |
| `EMAIL_USE_TLS` | Web, Worker | Use TLS | `True` |
| `EMAIL_HOST_USER` | Web, Worker | SMTP username | `apikey` or `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | Web, Worker | SMTP password / API token | `your-secret-token` |
| `DEFAULT_FROM_EMAIL` | Web, Worker | Sender email identity | `PulseDesk <noreply@pulsedesk.io>` |
| `SLA_MONITOR_INTERVAL_SECONDS` | Beat | Frequency of SLA evaluation loop | `60` |

### Frontend (`pulsedesk-frontend` on Vercel)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | HTTPS endpoint of the Render Django API | `https://pulsedesk-backend.onrender.com` |
| `VITE_WS_BASE_URL` | WSS endpoint for realtime WebSockets | `wss://pulsedesk-backend.onrender.com` |
| `VITE_APP_NAME` | Branding application title | `PulseDesk` |
| `VITE_APP_VERSION` | Frontend version tag | `1.0.0` |
| `VITE_ENABLE_WEBSOCKETS`| Feature flag for realtime notifications | `true` |
| `VITE_ENABLE_ANALYTICS` | Feature flag for analytics tracking | `false` |

---

## 6. Continuous Integration (GitHub Actions)

Two independent GitHub Actions workflows run on changes:

- **Backend CI ([.github/workflows/backend.yml](file:///home/alex/Documents/ProjectCatagory/pulsedesk/.github/workflows/backend.yml))**:
  - Triggers on `backend/**` changes.
  - Runs on Python 3.12 with pip caching.
  - Executes:
    1. `python backend/manage.py check --settings=config.settings.testing`
    2. `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.testing`
    3. `python backend/manage.py test apps --settings=config.settings.testing -v 2`

- **Frontend CI ([.github/workflows/frontend.yml](file:///home/alex/Documents/ProjectCatagory/pulsedesk/.github/workflows/frontend.yml))**:
  - Triggers on `frontend/**` changes.
  - Runs on Node.js 22 LTS with npm caching.
  - Executes:
    1. `npm run lint` (ESLint)
    2. `npm run build` (TypeScript compilation + Vite production build)
    3. `npm run test:run` (Vitest test suite)

---

## 7. Verification & Health Monitoring

Once deployed:
1. **API Health Check**:
   ```bash
   curl -i https://pulsedesk-backend.onrender.com/api/v1/health/
   # Returns: HTTP 200 OK {"status": "ok"}
   ```
2. **Dependency Health Probe**:
   ```bash
   curl -i https://pulsedesk-backend.onrender.com/api/v1/health/dependencies/
   # Returns status for Redis and Database
   ```
3. **Swagger / OpenAPI Documentation**:
   Navigate to `https://pulsedesk-backend.onrender.com/api/docs/` in your browser.
4. **Realtime WebSocket Handshake**:
   Test WebSocket connection at `wss://pulsedesk-backend.onrender.com/ws/operations/`.
