# PulseDesk Backend

Production-grade, multi-tenant incident management platform backend. Django 6 + Django REST Framework + Django Channels (WebSockets) + Celery/Redis + PostgreSQL (Supabase-compatible). Implements a domain-driven, service/selector-separated, RBAC-hardened API across **13.6 phases of end-to-end incident lifecycle management capabilities**.

| Attribute | Value |
|---|---|
| Django | 6.0.8 |
| DRF | 3.17.2 |
| Auth | JWT (djangorestframework-simplejwt 5.4.0 + token blacklist) |
| Realtime | Django Channels 4.3.2 + channels_redis 4.3.0 |
| Async | Celery 5.4.0 + Redis broker |
| DB | PostgreSQL / SQLite in-memory for tests |
| API docs | drf-spectacular 0.30.0 → /api/schema/, /api/docs/, /api/redoc/ |
| Python | 3.12+ |

---

## 1. Table of Contents

1. [Table of Contents](#1-table-of-contents)
2. [Project Status — All 13.6 Phases](#2-project-status--all-136-phases)
3. [Domain & Architecture](#3-domain--architecture)
4. [Getting Started — Local Development](#4-getting-started--local-development)
5. [Environment Configuration](#5-environment-configuration)
6. [Running the Backend (HTTP + WebSockets)](#6-running-the-backend)
7. [Running the Celery Workers & Beat Scheduler](#7-celery-workers--beat-scheduler)
8. [API Overview](#8-api-overview)
9. [Domain Modules (Apps)](#9-domain-modules-apps)
10. [RBAC Authorization Matrix](#10-rbac-authorization-matrix)
11. [Multi-Tenant Isolation Model](#11-multi-tenant-isolation-model)
12. [Realtime WebSocket Architecture](#12-realtime-websocket-architecture)
13. [Audit Logging Model](#13-audit-logging-model)
14. [Testing](#14-testing)
15. [Migrations](#15-migrations)
16. [Production Hardening Checklist](#16-production-hardening-checklist)
17. [Directory Tree](#17-directory-tree)

---

## 2. Project Status — All 13.6 Phases

Every phase below has been implemented and accepted; all integration-tested against `--settings=config.settings.testing`.

| Phase | Capability | Status | Primary modules |
|---|---|---|---|
| **1** | Backend Foundation (Django project, PostgreSQL, DRF project layout | ✅ Complete | [config/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config), [common/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/common) |
| **2** | Authentication — JWT login, register, email verify, password reset | ✅ Complete | [accounts/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/accounts) |
| **3** | Organizations / Multi-Tenancy Foundation | ✅ Complete | [organizations/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/organizations/models.py), [organizations/permissions.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/organizations/permissions.py) |
| **4** | Tenant-Aware RBAC — Permission / Role / RolePermission / Membership | ✅ Complete | [organizations/services.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/organizations/services.py) (RBACService + role-perm matrix), [organizations/selectors.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/organizations/selectors.py) (`user_has_permission`) |
| **5** | Incident Management — categories, assignees, status transitions, priorities | ✅ Complete | [incidents/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/incidents) |
| **6** | Workflow + SLA Engine — policies, targets, breach calculation, monitoring tasks | ✅ Complete | [sla/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/sla), [sla/tasks.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/sla/tasks.py) |
| **7** | Escalation Engine — policies, levels, rules, cross-tenant-safe evaluation | ✅ Complete | [escalation/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/escalation) |
| **8** | Celery + Redis broker infrastructure | ✅ Complete | [config/celery.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config/celery.py), [common/tasks.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/common/tasks.py) |
| **9** | Automated SLA Monitoring / Escalation — periodic monitoring, breach detection | ✅ Complete | [sla/services.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/sla/services.py) `SLAMonitorService |
| **10** | Notification & Delivery Engine — EMAIL/IN_APP channels + tasks | ✅ Complete | [notifications/services.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/notifications/services.py), [notifications/delivery.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/notifications/delivery.py), templates in `templates/emails/` |
| **11** | Operations Dashboard — summary/metrics/filtering read APIs | ✅ Complete | [dashboard/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/dashboard) |
| **12** | Real-Time Operations / Django Channels — org-scoped WS groups | ✅ Complete | [realtime/consumers.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/realtime/consumers.py), [realtime/events.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/realtime/events.py) |
| **13.1** | Comments — on-incident threaded, mentions, internal notes | ✅ Complete | [comments/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/comments) |
| **13.2** | Attachments — UUID-namespaced storage, mime + path-traversal hardening | ✅ Complete | [attachments/services.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/attachments/services.py) `AttachmentUploadService` |
| **13.3** | Audit Logging — append-only immutable, cross-tenant safe | ✅ Complete | [audit_logs/services.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/audit_logs/services.py) `AuditLogService` |
| **13.4** | Search & Filtering — incidents cross-tenant, RBAC-gated | ✅ Complete | [incidents/selectors.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/incidents/selectors.py) |
| **13.5** | Reports & Operational Analytics — trend & distribution aggregations | ✅ Complete | [reports/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/reports) |
| **13.6** | Organization & Platform Settings — typed, auditable per-org config | ✅ Complete | [settings/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/settings) + `OrganizationSettings` OneToOne |

---

## 3. Domain & Architecture

### Architectural principles (enforced, not aspirational)

```
Client (JWT Bearer)
    │
    ▼
HTTP Request / WebSocket Handshake
    │
    ▼
Django Middleware → Channels AuthMiddlewareStack
    │
    ▼
IsAuthenticated  ←──────────────────────────────── (Phase 2
    │
    ▼
IsOrganizationMember (404 cross-tenant; anti-enumeration)  ← Phase 3/4
    │
    ▼
user_has_permission(user, org, "<resource>.<action>")  ←── Phase 4 RBAC
    │
    ▼
DRF View  ───────────────────────────────── (thin, no business logic)
    │   ▲
    ▼   │
Services (writes / mutations) ───── transaction.on_commit() ───→ AuditLog
    │                              │
    │                              └──────────────────→ Realtime event
    │
    ▼
Selectors (reads / queries)
    │
    ▼
Django ORM — PostgreSQL / SQLite
```

Every request path honors the following invariants (see `apps/*/tests/ for tests that verify):

* **Service/query separation.** `services.py` = writes only business logic only (`@transaction.atomic`)
* **`selectors.py` = organization-scoped reads. `SELECT * FROM ... WHERE organization_id = $1`
* **No `.objects.all()` in tenant-facing code (cross-tenant leak blocker)**
* **Thin views.** Views marshall request → call selector/service → return response.
* **Append-only audit log (audit logs; `save()` on existing `AuditLog` raises ValidationError.
* **Transaction-before-commit realtime events** — never publish inconsistent state; only commit, prevents phantom events on rollback.
* **JWT-in-header auth for WebSockets** (no `?token=` query param so tokens never appear in access logs / monitoring dashboards.

---

## 4. Getting Started — Local Development

Prerequisites: **Python 3.12+, PostgreSQL 15+, Redis 7+.

```powershell
# 1. Clone + enter backend
cd pulsedesk/backend

# 2. Virtualenv (Windows)
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3. Install dependencies
python -m pip install --upgrade pip
pip install -r requirements/development.txt

# 4. Create local .env (see §5 for full reference
cp .env.example .env

# 5. Run migrations (use SQLite-free alternative — local PostgreSQL
#   -> OR set DATABASE_URL=postgres://user:pass@localhost:5432/pulsedesk
```

Then run system check:
```powershell
python manage.py check --settings=config.settings.development
```

Seed the RBAC base permissions (one-time, the Organization creation service does this automatically when you create an org, but you can pre-initialize into any management command:
```powershell
python manage.py seed_rbac --settings=config.settings.development
```

---

## 5. Configuration

Settings live in [config/settings/](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config/settings):

| Settings module | Use case | DB | Broker | Email | Storage | CHANNEL_LAYERS |
|---|---|---|---|---|---|---|
| `base.py` | Shared defaults | env(`DATABASE_URL`) | `CELERY_BROKER_URL` | `EMAIL_URL` | localfilesystem | Redis (**required** override in all envs; tests/dev/prod) |
| `testing.py` | `pytest` / `manage.py test` | **SQLite in-memory** | memory | LocMem | InMemoryStorage | **InMemoryChannelLayer** |
| `development.py` | `manage.py runserver / daphne dev | PostgreSQL or SQLite | Redis | Console | localfilesystem | Redis |
| `production.py` | uvicorn/gunicorn/daphne PaaS | PostgreSQL (Supabase PG pooler safe) | Redis | SMTP via `EMAIL_URL` | S3-compatible | Redis |

### Mandatory `.env` keys (base + dev/prod)

```env
# Django
SECRET_KEY=your-strong-secret-...
DEBUG=False (prod) / True (dev)
ALLOWED_HOSTS=example.com,www.example.com (prod) / 127.0.0.1,localhost (dev)

# PostgreSQL (Supabase-compatible)
DATABASE_URL=postgres://user:password@db.example.com:5432/pulsedesk

# Redis (Celery broker + Channels layer + cache)
REDIS_URL=redis://:password@redis.example.com:6379/0
CELERY_BROKER_URL=${REDIS_URL}

# Email (any smtp+smtp+tls, console for dev)
EMAIL_URL=smtp+tls://apikey:SG.xxx@smtp.sendgrid.net:587
DEFAULT_FROM_EMAIL="PulseDesk <noreply@pulsedesk.example.com>"

# Frontend (email redirect URLs
FRONTEND_URL=https://app.pulsedesk.example.com
FRONTEND_VERIFY_EMAIL_URL=${FRONTEND_URL}/auth/verify-email
FRONTEND_PASSWORD_RESET_URL=${FRONTEND_URL}/auth/reset-password

# Django channels prod (additional allowed origins for WebSocket handshakes
CORS_ALLOWED_ORIGINS=https://app.pulsedesk.example.com
CSRF_TRUSTED_ORIGINS=https://app.pulsedesk.example.com
```

**Non-negotiable hard rule (from Phase 12 lessons learned)**: `CHANNEL_LAYERS` **must be set in every settings module** (testing/production/development)** — Phase 12 tests otherwise fail otherwise fail silently and consumers cannot publish.

---

## 6. Running the Backend

### HTTP + WebSockets (ASGI)
```powershell
# Development (auto-reload)
daphne -b 127.0.0.1 -p 8000 config.asgi:application --settings=config.settings.development
# or:
python manage.py runserver --settings=config.settings.development
```

ASGI entrypoint: [config/asgi.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config/asgi.py)

```
HTTP     → 1:/ →
```

Production (gunicorn+uvicorn workers (HTTP+WS workers with uvicorn.workers.UvicornWorker workers (HTTP/WS on 4 processes recommended):
```bash
gunicorn config.asgi:application \
  -k uvicorn.workers.UvicornWorker \
  -w 4 -b 0.0.0.0:8000 \
  --env DJANGO_SETTINGS_MODULE=config.settings.production
```

---

## 7. Celery Workers & Beat Scheduler

Broker + Result Backend are both Redis (`redis://` URLs.

Celery entrypoint: [config/celery.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config/celery.py)
Autodiscovers `tasks.py` in every `INSTALLED_APPS` app.

```powershell
# Worker (execute SLA monitoring, notification delivery, audit-will queue
celery -A config worker --loglevel=INFO --settings=config.settings.development

# Beat scheduler (periodic tasks
celery -A config beat --loglevel=INFO --settings=config.settings.development
```

**Registered periodic tasks** (see common/apps.py `ready()` + common/tasks.py):
| Name | Schedule | Purpose |
|---|---|---|
| `sla.tasks.monitor_all_slas` | every 60s | Scans open incidents, detects SLA response/resolution breaches, fires warnings + escalation triggers |
| `common.tasks.health_check_ping` | every 5 min | no-op health keepalive for queue liveness probe |

---

## 8. API Overview

All API routes are mounted under [config/urls.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/config/urls.py):

| Prefix | Purpose | App |
|---|---|---|
| `/admin/` | Django staff admin | django.contrib.admin |
| `/api/v1/` | API root + health + dependency health | [api_v1/urls.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/api_v1/urls.py) |
| `/api/v1/auth/` | register / login / refresh / verify-email / password-reset | [accounts/urls.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/accounts/urls.py) |
| `/api/v1/organizations/` | **everything tenant-scoped: CRUD, members, roles, RBAC, incidents, SLA, escalations, comments, attachments, **dashboard, audit, audit logs, reports, settings | [organizations/urls.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/organizations/urls.py) |
| `/api/v1/notifications/` | per-user notification list, mark-read | [notifications/urls.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/notifications/urls.py) |
| `/api/schema/` | OpenAPI 3.1 YAML | drf-spectacular |
| `/api/docs/` | Swagger UI interactive docs | drf-spectacular Swagger |
| `/api/redoc/` | ReDoc interactive docs | drf-spectacular Redoc |
| `/ws/` | WebSocket endpoint (Channels) | [realtime/routing.py](file:///c:/Users/hp/Documents/ProjectCatagori/pulsedesk/backend/apps/realtime/routing.py) `ws://…/ws/organizations/<org_id>/operations/` |

### Health

```bash
GET /api/v1/health/         → { "status": "ok"
GET /api/v1/health/dependencies/ → { "status": "ok", "postgres": "...", "redis": "..." }
```

### OpenAPI / Postman

```bash
curl http://127.0.0.1:8000/api/schema/  → schema.yml (for Postman import-compatible.

Interactive browser → `/api/docs/ for Swagger UI.

---

## 9. Domain Modules (Apps)

Each app follows the identical 9-file scaffold convention (see apps/*/ for all of these exist).

| App | Purpose | Services/Selectors files |
|---|---|---|
| `accounts` | User model, JWT auth flows, email delivery (verification / pw reset | `services.py` (`AuthService`, `selectors.py` `get_user_by_email` |
| `organizations` | Org model, Membership, RBAC Permission / Role / RolePermission + seeder command + `user_has_permission` selector | `services.py` `OrganizationService`, `RBACService`, `selectors.py:138` `user_has_permission` |
| `incidents` | Incident, IncidentCategory, priority/status enum, workflow transitions + search/filter | `services.py` `IncidentService`, `selectors.py` `list_incidents` with filters |
| `sla` | SLAPolicy → SLATarget → IncidentSLA (one per incident/policy), breach calculation, `SLAMonitorService` | `services.py` monitor, `tasks.py` periodic |
| `escalation` | EscalationPolicy / EscalationLevel / EscalationRule / EscalationEvent | `services.py` EscalationEvaluationService |
| `notifications` | Notification (IN_APP per user) + delivery (EMAIL) dispatcher Celery tasks | `services.py` NotificationService, `delivery.py` |
| `dashboard` | 5 endpoints summary metrics, priority distribution, SLA metrics, escalation metrics, paginated incident list | `selectors.py` (dashboard views read from selectors not services) |
| `realtime` | `IncidentEventsConsumer, org-scoped groups. Events enum, `transaction.on_commit()` publish helpers | `consumers.py`, `events.py`, `services.py` |
| `comments` | Incident comments, @mentions extraction, internal notes | `services.py` CommentService |
| `attachments` | File upload + download + delete, UUID file naming `<org>/<incident>/<uuid>.ext | `services.py` AttachmentUploadService |
| `audit_logs` | Immutable append-only AuditLog (15 AuditAction choices | `services.py:46` AuditLogService.log() |
| `reports` | Incident trend over time, SLA attainment, per-category distribution aggregations | `selectors.py` aggregation |
| `settings` | OrganizationSettings OneToOne per org. 8 typed fields across 4 categories | `services.py` + `selectors.py` lazy backfill |

### Pattern summary table of all module structure convention:
```
apps/<name>/
├── migrations/        Django migrations
├── tests/       per-convention 1..5 test files
├── models.py
├── admin.py
├── permissions.py   (reuses primitives from organizations/permissions.py where possible)
├── selectors.py   reads (org-scoped)
├── serializers.py
├── services.py    writes (@atomic)
├── urls.py
└── views.py       (thin APIView or ViewSet)
```

---

## 10. RBAC Authorization Matrix

### Permission system

Every organization owns 5 immutable roles (auto-created when org is seeded):

```python
# organizations/services.py

Permission codenames follow `<resource>.<action>`:
```

### 5 roles

| Role slug | Scope | View settings | Modify settings | Incidents manage | SLA manage | Escalation manage | Audit view | Org update |
|---|---|---|---|---|---|---|---|---|
| `organization-owner` | org creator / legal authority on org (full perms via `_ALL_PERMISSIONS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization-admin` | org operational admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `operations-manager` | senior IC manager | ✅ (only view org settings, cannot modify** cannot | ✅ | ✅ (per Phase 13.6 spec "Cannot change org settings per org settings.) | ❌ | ❌ |
| `agent` | frontline support engineer | ✅ | ❌ | ✅ (incident.view + incident.manage only) | ❌ | ❌ | ❌ |
| `viewer` | read-only stakeholder | ✅ | ❌ | only) | ❌ | ❌ | ❌ | ❌ |

**Key rule:** RBAC check entry point always use `from organizations.selectors import user_has_permission(user, organization, codename)`. return True/False. **Always always always** use organization ID lookup against the organization-scoped Role → RolePermission → Membership → RBAC, 4-step membership. always True/False. **never skip any shortcut.

---

## 11. Multi-Tenant Isolation Model

Hard guarantees:

* Every resource belongs to `organization_id` FK (no tenancy leak via `created without exception:
* `IsOrganizationMember(request) → sets `request.organization` always sets request.membership → return 404 Not Found always when org UUID invalid / user not a member / membership.state in {SUSPENDED, REMOVED} → forbidden 403 (prevents org-id enumeration attacks cannot cannot cannot cannot differentiate "org doesn't exist" OR "you can't tell you aren't a member". Can't leak "does not exist therefore I know I can enumerate org B data).
* Every selector writes queries always filters by organization_id; never returns the org from request.organization → `.objects.all()` is absent from all apps selector code paths.
* Realtime: Django Channels `IncidentEventsConsumer` verifies membership before WebSocket `accept()`, and only subscribes to group `f"org:{org_id}:*"` channels groups are org-scoped; no cross-org leak via WS publish message.
* AuditLogService.log receives the resource_type and actors.organization is audited org.organization always from the request.organization for the actor;

The 10-item Phase 13.6 security matrix tests enforce this for every security tests for cross-org reads and SettingsSecurityMatrixTest` in apps/settings/tests/test_views.py, plus the same patterns in every app's cross-tenant security tests (see apps/*/tests/test_*.py).

---

## 12. Realtime WebSocket Architecture

```
Client Upgrade
│
▼
│ Header Sec-WebSocket-Protocol: authorization, Bearer <token>
│
▼
channels.auth.AuthMiddlewareStack → custom header auth via bearer_extractor
│
▼
realtime.consumers.IncidentEventsConsumer
│   connect():
│     - lookup URL param: organizations/<uuid>/operations/
│     verify org membership via user_has_permission
│     join three org-scoped group "org:{org_id}
│     ├── incident.created
│     └── operations
│
▼
Events published via realtime.services.publish_realtime_event(org_idempotency via transaction.on_commit() (see incidents/services.py, etc.)
```

Channels auth note from Phase 12: custom **bytes/str comparison for bearer token header. WS path is always the query parameter never never passes JWT in the URL.

---

## 13. Audit Logging Model

### Audit Log
[audit_logs/models.py`AuditLog` + AuditAction (TextChoices) (Phase 13.6 adds SETTINGS_UPDATED =):

Action enum entries.

| Action enum |
|---|
| `incident.created`, `incident.updated`, `incident.assigned`, `incident.status_changed`, `incident.priority_changed` |
| `comment.created`, `comment.deleted` + Phase 13.1 |
| `attachment.created`, `attachment.deleted` |
| `role.created`, `role.assigned` |
| `settings.updated` ← 13.6 |

Audit log invariant (Phase 13.3 established):

* Immutable once written — calling `.save()` over raise ValidationError immutability guard:
* actor (actor can be User or None (=system actor
* `changes={"before": {...}, "after": {...}}` (JSON, safe for secrets not written
* `ip_address` extracted from XFF when provided
* organization FK non-null, CASCADE on org delete

Log writing entry deletes its audit logs when organization (org deletion cascades.

---

## 14. Testing

Always run with `--settings=config.settings.testing` so you runtests against SQLite (SQLite in-memory. **Never never target the production/Supabase connection pooler for the test runner (Supabase PgBouncer drops connections in the middle of long CREATE TABLE will "server closed closed unexpectedly).

```powershell
# Fast sanity checks
python manage.py check --settings=config.settings.testing
python manage.py makemigrations --check --settings=config.settings.testing

# All 1013 tests (as of Phase 13.6)
python manage.py test --settings=config.settings.testing -v 2

# Run single-app tests (only settings tests run last 76 of this
python manage.py test apps.settings.tests --settings=config.settings.testing -v 2

# Only realtime
python manage.py test apps.realtime.tests --settings=config.settings.testing
```

Test convention (per app, 5 files wherever coverage:
```
apps/<name>/tests/
├── test_models.py       field-level + relationship integrity
├── test_services.py     service-layer business logic
├── test_selectors.py   org-scoping / cross-tenant reads
├── test_permissions.py  RBAC matrix × 5 roles × view/manage pairs
└── test_views.py       API HTTP codes, audit emission, unknown-validation boundary + security 10-item matrix for security-sensitive apps (settings, incidents, attachments, comments, etc.)
```

---

## 15. Migrations

```powershell
# Generate migration
python manage.py makemigrations <app_name> --settings=config.settings.development

# Apply (dev)
python manage.py migrate --settings=config.settings.development

# Production (zero-downtime order):
python manage.py migrate --settings=config.settings.production --noinput
```

Data-migration pattern used for e.g. apps/settings/migrations/0001_initial.py used RunPython to backfill defaults for legacy orgs (bulk_create batch_size=500 to constant memory.

---

## 16. Production Hardening Checklist

Before deploying production (Phase production

| Item |  |
|---|---|
| ✔ | DEBUG = False |
| ✔ | SECRET_KEY loaded from secret manager (never commit in repo) |
| ✔ | ALLOWED_HOSTS explicit (never wildcard |
| ✔ | CSRF_TRUSTED_ORIGINS = [https://frontend domain |
| ✔ | CORS_ALLOWED_ORIGINS whitelist only |
| ✔ | SECURE_SSL_REDIRECT, HSTS, secure cookies |
| ✔ | DATABASE_URL connection pooler (Supabase PgBouncer transactional mode safe) |
| ✔ | Redis TLS + password in REDIS_URL |
| ✔ | EMAIL_URL SMTP TLS 587 / 465) |
| ✔ | DEFAULT_FROM_EMAIL DMARC / SPF / DKIM set up |
| ✔ | CHANNEL_LAYERS Redis, and ALLOWED_HOSTS origin validator on |
| ✔ | STATIC_ROOT + collectstatic + CDN |
| ✔ | Media / attachments on S3-compatible bucket CORS scoped |
| ✔ | File upload size + allowed MIMEs enforced by AttachmentUploadService |
| ✔ | manage.py check --deploy pass |
| ✔ | Dependency health check `/health/dependencies/ mounted on liveness probe |
| ✔ | Celery worker + Beat liveness / readiness (separate pods + separate deployments |
| ✔ | Ws workers → workers behind ALB / Nginx sticky sessions for WS affinity |

---

## 17. Directory Tree

```
backend/
├── apps/
│   ├── accounts/                     Phase 2 auth
│   ├── api_v1/                    root + health endpoints
│   ├── attachments/                Phase 13.2
│   ├── audit_logs/               Phase 13.3
│   ├── comments/                  Phase 13.1
│   ├── common/                    base + Celery foundation
│   ├── dashboard/               Phase 11
│   ├── escalation/              Phase 7
│   ├── incidents/               Phase 5
│   ├── notifications/          Phase 10
│   ├── organizations/   Phases 3 + 4 (RBAC + Membership
│   ├── realtime/            Phase 12
│   ├── reports/               Phase 13.5
│   ├── settings/             Phase 13.6
│   └── sla/                   Phase 6 + 9
├── config/
│   ├── settings/      base.py / development.py / production.py / testing.py
│   ├── asgi.py             Channels + HTTP ASGI entrypoint
│   ├── celery.py           Celery app
│   ├── urls.py           root URLconf
│   └── wsgi.py           (legacy sync entrypoint
├── requirements/
│   ├── base.txt            shared pip deps
│   ├── development.txt    dev extras (black, isort)
│   └── production.txt   production.txt  prod extras (sentry, gunicorn, uvicorn)
├── templates/
│   └── emails/              account + notifications HTML/TXT emails (verification, pw reset, incident/ escalation breach/warning)
├── manage.py
├── mypy.ini
├── schema.yml              OpenAPI snapshot
├── setup.cfg             black / isort / flake8 config
└── README.md             this document ☝️
```
