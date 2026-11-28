"""Seed disposable CI only. Never use a real account or database."""
import os
from pathlib import Path
from datetime import timedelta
from django.conf import settings
from django.db import connection
from django.contrib.auth import get_user_model
from django.utils import timezone
from services.models import Service

assert os.environ.get("CI")=="true" and settings.DEBUG and not os.environ.get("VERCEL_ENV")
assert connection.vendor=="sqlite" and Path(str(connection.settings_dict["NAME"])).name=="octalve-host-final-browser.sqlite3"
assert not get_user_model().objects.exists(), "Never seed existing data"
User=get_user_model()
password="Synthetic-only-Browser-2026!"
admin=User.objects.create_superuser(email="admin@fixture.example.test",username="fixture-admin",password=password,
    full_name="Synthetic Admin",email_verified_at=timezone.now())
owner=User.objects.create_user(email="owner@fixture.example.test",username="fixture-owner",password=password,
    full_name="Synthetic Customer",email_verified_at=timezone.now())
other=User.objects.create_user(email="other@fixture.example.test",username="fixture-other",password=password,
    full_name="Other Synthetic Customer",email_verified_at=timezone.now())
for user,domain in ((owner,"fixture-own.example.test"),(other,"fixture-other.example.test")):
    Service.objects.create(client=user,product_id=1,plan_id=1,service_type="hosting",status="pending",
        label="Synthetic hosting",domain_name=domain,billing_cycle="1mo",amount=1000,currency="NGN",
        next_due_date=timezone.now()+timedelta(days=10))
