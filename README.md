# Octalve Console Backend Skeleton

This backend folder is a Django architecture skeleton for the backend developer. It is intentionally separated from the Next.js frontend.

Recommended stack:

- Django
- Django REST Framework
- PostgreSQL
- Redis + Celery/RQ for provisioning queue and cron jobs
- Encrypted settings/secrets for provider credentials

The frontend can run now without this backend. The backend developer should use this folder as the API and adapter architecture starting point.
