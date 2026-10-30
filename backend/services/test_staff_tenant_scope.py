"""P0 Staff read isolation against real Django lists and object lookups."""
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from services.models import Service
from provisioning.models import ProvisioningTask

User=get_user_model()

class StaffInfrastructureScopeTests(TestCase):
    def setUp(self):
        self.customer=User.objects.create_user(
            email="infrastructure-owner@example.invalid",username="infra_owner",role="client",password="test-only")
        self.staff=User.objects.create_user(
            email="infrastructure-staff@example.invalid",username="infra_staff",role="staff",is_staff=True,password="test-only")
        self.superuser=User.objects.create_superuser(
            email="infrastructure-admin@example.invalid",username="infra_admin",password="test-only")
        self.service=Service.objects.create(
            client=self.customer,product_id=1,plan_id=1,label="Private customer hosting",
            service_type="hosting",billing_cycle="1mo",amount=Decimal("100.00"),
            next_due_date=timezone.now(),status="active")
        self.task=ProvisioningTask.objects.create(
            service=self.service,action="sync_usage",adapter_type="test-only",status="queued")

    def test_staff_cannot_read_other_customers_services(self):
        api=APIClient()
        api.force_authenticate(user=self.staff)
        result=api.get("/api/services/services/")
        self.assertEqual(result.status_code,200,result.data)
        rows=result.data.get("results",[]) if isinstance(result.data,dict) else result.data
        self.assertEqual(len(rows),0)
        detail=api.get(f"/api/services/services/{self.service.pk}/")
        self.assertEqual(detail.status_code,404)

    def test_role_only_admin_cannot_read_other_tenants_or_edit_services(self):
        role_only = User.objects.create_user(
            email="infra-role-only@example.invalid", username="infra_role_only",
            role="admin", is_staff=False, password="test-only")
        api = APIClient()
        api.force_authenticate(user=role_only)
        response = api.get("/api/services/services/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", []) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(rows), 0)
        self.assertEqual(
            api.get(f"/api/services/services/{self.service.pk}/").status_code, 404)
        self.assertEqual(
            api.patch(f"/api/services/services/{self.service.pk}/", {}, format="json").status_code,
            403)
        self.assertEqual(api.get("/api/provisioning/tasks/").status_code, 403)

    def test_staff_cannot_inspect_unassigned_provisioning_payload(self):
        api=APIClient()
        api.force_authenticate(user=self.staff)
        for endpoint in ("/api/provisioning/tasks/",
                         f"/api/provisioning/tasks/{self.task.pk}/",
                         "/api/provisioning/queues/"):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(api.get(endpoint).status_code,403)
        api.force_authenticate(user=self.superuser)
        self.assertEqual(api.get(f"/api/provisioning/tasks/{self.task.pk}/").status_code,200)
