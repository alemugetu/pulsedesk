# PulseDesk — Production Deployment & CI/CD Guide (Containerless)

This document provides complete instructions for deploying and maintaining PulseDesk across **Render**, **Vercel**, and **GitHub Actions** without Docker.

All backend infrastructure (Django Web Service, Celery Worker, Celery Beat, Redis, and PostgreSQL Database) is hosted directly on **Render** within a secure private network.

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
        Internal Redis           │             │ PostgreSQL (Internal)
        ┌────────────────────────┼────────┐    │
        │                        │        │    ▼
        ▼                        ▼        │ ┌─────────────────────────┐
┌───────────────┐        ┌──────────────┐ │ │ Render Managed          │
│ Render Worker │        │ Render Beat  │ │ │ PostgreSQL Database     │
│ (Celery)      │        │ (Scheduler)  │ │ │ (pulsedesk-db)          │
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
| **Database** | Render | Managed PostgreSQL | Managed Postgres (`pulsedesk-db`) with internal private connectivity |
| **Frontend** | Vercel | Static / SPA | React + Vite + TypeScript with client-side rewrites |
| **CI Automation** | GitHub Actions | Ubuntu / Node 22 / Python 3.12 | Automated checks, linting, and tests |

---

## 2. Render Deployment (1-Click Blueprint)

Render Infrastructure as Code is defined in [render.yaml](file:///home/alex/Documents/ProjectCatagory/pulsedesk/render.yaml).

### Option A: Using Render Blueprints (Recommended)

1. Push this repository to your GitHub account.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New > Blueprint**.
3. Connect your repository. Render will automatically parse [render.yaml](file:///home/alex/Documents/ProjectCatagory/pulsedesk/render.yaml).
4. Render automatically provisions and links:
   - `pulsedesk-db` (Managed PostgreSQL Database)
   - `pulsedesk-redis` (Managed Redis)
   - Injects the `DB_URL` connection string automatically into Backend, Worker, and Beat.
   - Injects the `CELERY_BROKER_URL` connection string automatically into Backend, Worker, and Beat.
5. Render will only prompt you for the remaining application variables:
   - `ALLOWED_HOSTS`: `pulsedesk-backend.onrender.com` (and your custom domain if applicable).
   - `CORS_ALLOWED_ORIGINS`: Your Vercel frontend URL, e.g. `https://pulsedesk.vercel.app`.
   - `CSRF_TRUSTED_ORIGINS`: `https://pulsedesk-backend.onrender.com,https://pulsedesk.vercel.app`.
   - `FRONTEND_URL`: `https://pulsedesk.vercel.app`.
   - `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`: SMTP credentials.
6. Click **Apply**. Render will build and deploy all services.

### Option B: Manual Configuration on Render

If configuring services individually without the Blueprint:

#### 1. PostgreSQL Database (`pulsedesk-db`)
- **Type**: PostgreSQL
- **Name**: `pulsedesk-db`
- **Database**: `pulsedesk`
- **User**: `pulsedesk`
- **Plan**: Starter (or Free)
- Copy the **Internal Database URL** (`postgres://...`).

#### 2. Redis (`pulsedesk-redis`)
- **Type**: Redis
- **Name**: `pulsedesk-redis`
- **Plan**: Starter (or Free)
- Copy the **Internal Redis URL** (`redis://...`).

#### 3. Django Web Service (`pulsedesk-backend`)
- **Type**: Web Service
- **Runtime**: Python 3
- **Build Command**: `./render-build.sh`
- **Start Command**: `cd backend && daphne -b 0.0.0.0 -p $PORT config.asgi:application`
- **Health Check Path**: `/api/v1/health/`
- **Environment Variables**: See Environment Variables Matrix below.

#### 4. Celery Worker (`pulsedesk-worker`)
- **Type**: Background Worker
- **Runtime**: Python 3
- **Build Command**: `pip install -r backend/requirements/production.txt`
- **Start Command**: `cd backend && celery -A config worker --loglevel=INFO`
- **Environment Variables**: Same `DB_URL`, `CELERY_BROKER_URL`, `SECRET_KEY`, and email settings as backend.

#### 5. Celery Beat (`pulsedesk-beat`)
- **Type**: Background Worker
- **Runtime**: Python 3
- **Build Command**: `pip install -r backend/requirements/production.txt`
- **Start Command**: `cd backend && celery -A config beat --loglevel=INFO`
- **Environment Variables**: Same `DB_URL`, `CELERY_BROKER_URL`, and `SECRET_KEY` as worker.

---

## 3. Vercel Deployment (Frontend)

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

## 4. Environment Variables Reference

### Backend (`pulsedesk-backend`, `pulsedesk-worker`, `pulsedesk-beat`)

| Variable | Injected Automatically by Blueprint | Description | Example |
|---|---|---|---|
| `DJANGO_SETTINGS_MODULE` | Yes | Django settings module | `config.settings.production` |
| `SECRET_KEY` | Yes (Generated) | Cryptographic signing key | `django-insecure-prod-key-xyz...` |
| `DB_URL` | Yes (from `pulsedesk-db`) | Render PostgreSQL connection string | `postgres://pulsedesk:pass@dpg-xxx-a/pulsedesk` |
| `CELERY_BROKER_URL` | Yes (from `pulsedesk-redis`) | Redis broker URL | `redis://red-xxxx:6379` |
| `CELERY_RESULT_BACKEND`| Yes (from `pulsedesk-redis`) | Redis result backend | `redis://red-xxxx:6379` |
| `CHANNEL_REDIS_URL` | Yes (from `pulsedesk-redis`) | Channels Redis layer URL | `redis://red-xxxx:6379` |
| `ALLOWED_HOSTS` | Manual | Comma-separated list of allowed hostnames | `pulsedesk-backend.onrender.com,api.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | Manual | Allowed frontend origins | `https://pulsedesk.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | Manual | Trusted origins for CSRF checks | `https://pulsedesk-backend.onrender.com,https://pulsedesk.vercel.app` |
| `FRONTEND_URL` | Manual | Base URL for password reset and verify emails | `https://pulsedesk.vercel.app` |
| `EMAIL_HOST` | Manual | SMTP server hostname | `smtp.sendgrid.net` or `smtp.gmail.com` |
| `EMAIL_PORT` | Yes (Default: 587) | SMTP port | `587` |
| `EMAIL_USE_TLS` | Yes (Default: True) | Use TLS | `True` |
| `EMAIL_HOST_USER` | Manual | SMTP username | `apikey` or `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | Manual | SMTP password / API token | `your-secret-token` |
| `DEFAULT_FROM_EMAIL` | Manual | Sender email identity | `PulseDesk <noreply@pulsedesk.io>` |
| `SLA_MONITOR_INTERVAL_SECONDS` | Yes (Default: 60) | Frequency of SLA evaluation loop | `60` |

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

## 5. Continuous Integration (GitHub Actions)

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

## 6. Verification & Health Monitoring

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
