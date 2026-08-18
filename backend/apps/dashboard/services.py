"""
Dashboard Services Module

Per architectural requirements (Phase 11):
  - The dashboard is a READ-MODEL/API layer
  - All read queries go through dashboard.selectors
  - This module is intentionally minimal/empty
  - Services.py is for orchestration-level composition only
  - Simple queryset operations live in selectors.py

If future phases require orchestration (combining reads with side-effect operations),
that logic can be added here.
"""
