#!/usr/bin/env bash
# ==============================================================================
# PulseDesk — Render Build Script (Containerless Deployment)
# ==============================================================================
# This script runs during the Render build phase for the Django web service.
# It installs production dependencies, collects static assets, and applies
# database migrations to the configured Supabase PostgreSQL database.
# ==============================================================================

set -o errexit
set -o nounset
set -o pipefail

echo "===> [1/3] Installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements/production.txt

echo "===> [2/3] Collecting static files..."
python backend/manage.py collectstatic --noinput --settings=config.settings.production

echo "===> [3/3] Applying database migrations..."
python backend/manage.py migrate --noinput --settings=config.settings.production

echo "===> PulseDesk build completed successfully!"
