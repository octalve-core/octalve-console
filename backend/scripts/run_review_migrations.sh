#!/usr/bin/env bash
# One-time, explicitly approved Neon Preview migration from a trusted Codespace.
# No HTTP migration endpoints; no local or commercial production databases.
set -euo pipefail
mode="${1:-}"
if [[ "$mode" != "plan" && "$mode" != "apply" ]]; then
  echo "Usage: bash backend/scripts/run_review_migrations.sh plan|apply" >&2
  exit 2
fi
if [[ "$(git branch --show-current)" != "review/cloud-portability-security-foundation" ]]; then
  echo "Refusing: checkout the Octalve Cloud review branch first." >&2
  exit 2
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing: review worktree has uncommitted changes." >&2
  exit 2
fi
if [[ -z "${CLOUD_REVIEW_DATABASE_URL_UNPOOLED:-}" ]]; then
  echo "Missing Codespaces secret CLOUD_REVIEW_DATABASE_URL_UNPOOLED." >&2
  exit 2
fi
export DATABASE_URL="$CLOUD_REVIEW_DATABASE_URL_UNPOOLED"
export DEBUG=false
export VERCEL_ENV=preview
export OCTALVE_CLOUD_ENV=review
export CLOUD_REVIEW_MIGRATION_CONFIRM=explicit-codespace-review
export FRONTEND_URL="https://octalve-console.vercel.app"
# Signing key is throwaway, for one-off management command only.
export DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
echo "Installing Django review dependencies (no customer database changes yet)."
python -m pip install -r backend/requirements.txt --quiet
echo "Checking Neon database identity, direct connection, TLS and existing schema."
python backend/scripts/review_db_preflight.py
echo "Displaying Django migration plan."
(cd backend && python manage.py migrate --plan)
if [[ "$mode" == "plan" ]]; then
  echo "PLAN COMPLETE. No migrations were applied."
  exit 0
fi
echo "The next action changes the isolated Neon Preview database schema."
read -r -p "Type APPLY TO OCTALVE REVIEW ONLY to confirm: " answer
if [[ "$answer" != "APPLY TO OCTALVE REVIEW ONLY" ]]; then
  echo "Not approved. No migrations were applied."
  exit 2
fi
echo "Applying reviewed Django migrations to Neon Preview."
(cd backend && python manage.py migrate --noinput)
echo "Migration ledger:"
(cd backend && python manage.py showmigrations --plan)
echo "REVIEW MIGRATION COMPLETED. Do not infer browser acceptance from this output."
