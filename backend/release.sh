#!/usr/bin/env bash
set -Eeuo pipefail

echo "[release] Installing backend dependencies"
pip install -r requirements.txt

echo "[release] Running deploy checks"
python manage.py check --deploy

echo "[release] Showing migration plan"
python manage.py showmigrations --plan

echo "[release] Applying database migrations"
python manage.py migrate --noinput

echo "[release] Collecting static assets"
python manage.py collectstatic --noinput

echo "[release] Backend release steps completed"
