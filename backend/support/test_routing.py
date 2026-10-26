"""No money, no email transport, and no server changes: support isolation."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from support.models import SupportDepartment,SupportRoutingTag,SupportTicket,TicketMessage

class SupportRoutingTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.customer=User.objects.create_user(email="customer-support@example.invalid",
            username="customer_support",password="CI-strong-test-secret",role="client")
        self.stranger=User.objects.create_user(email="stranger-support@example.invalid",
            username="stranger_support",password="CI-strong-test-secret",role="client")
        self.dns_agent=User.objects.create_user(email="dns-agent@example.invalid",
            username="dns_agent",password="CI-strong-test-secret",role="staff")
        self.email_agent=User.objects.create_user(email="email-agent@example.invalid",
            username="email_agent",password="CI-strong-test-secret",role="staff")
        self.outsider=User.objects.create_user(email="outside-agent@example.invalid",
            username="outside_agent",password="CI-strong-test-secret",role="staff")
        self.admin=User.objects.create_user(email="support-admin@example.invalid",
            username="support_admin",password="CI-strong-test-secret",role="admin")
        self.dept=SupportDepartment.objects.create(name="Technical Support",auto_assign=True)
        self.dept.assigned_staff.set([self.dns_agent,self.email_agent])
        self.other_dept=SupportDepartment.objects.create(name="Billing Support")
        self.other_dept.assigned_staff.add(self.outsider)
        self.dns=SupportRoutingTag.objects.create(department=self.dept,label="DNS",slug="dns")
        self.email=SupportRoutingTag.objects.create(department=self.dept,label="Email",slug="email")
        self.dns.assigned_staff.add(self.dns_agent)
        self.email.assigned_staff.add(self.email_agent)
        self.api=APIClient()
        self.api.force_authenticate(user=self.customer)

    def create(self,tag=None,dept=None):
        payload={"department_id":dept or self.dept.pk,
            "subject":"My hosting DNS is incorrect",
            "priority":"medium","message":"My domain is showing an incorrect record."}
        if tag is not None:payload["routing_tag_id"]=tag
        return self.api.post("/api/support/tickets/",payload,format="json")

    def test_ticket_reference_is_unique_without_shared_sequence_counter(self):
        references=[SupportTicket(client=self.customer,department=self.dept,
            subject="test",priority="medium").generate_ticket_number() for _ in range(100)]
        self.assertEqual(len(references),len(set(references)))
        self.assertTrue(all(len(ref)<=20 for ref in references))

    def test_specialist_topic_routes_to_eligible_agent(self):
        r=self.create(tag=self.dns.pk)
        self.assertEqual(r.status_code,201,r.data)
        ticket=SupportTicket.objects.get(pk=r.data["id"])
        self.assertEqual(ticket.assigned_to_id,self.dns_agent.pk)
        self.assertEqual(ticket.routing_tag_id,self.dns.pk)
        self.assertEqual(ticket.messages.count(),1)

    def test_unstaffed_topic_waits_in_queue(self):
        self.dns.assigned_staff.clear()
        r=self.create(tag=self.dns.pk)
        self.assertEqual(r.status_code,201,r.data)
        self.assertIsNone(SupportTicket.objects.get(pk=r.data["id"]).assigned_to)

    def test_foreign_tag_rejected_without_creating_ticket(self):
        r=self.create(tag=self.email.pk,dept=self.other_dept.pk)
        self.assertEqual(r.status_code,400,r.data)
        self.assertFalse(SupportTicket.objects.exists())

    def test_client_cannot_assign_self_set_internal_note_or_see_it(self):
        r=self.create(tag=self.dns.pk)
        pk=r.data["id"]
        self.assertEqual(self.api.post(f"/api/support/tickets/{pk}/action/",
            {"action":"assign","staff_id":self.outsider.pk},format="json").status_code,403)
        self.assertEqual(self.api.post(f"/api/support/tickets/{pk}/reply/",
            {"message":"Secret","is_internal":True},format="json").status_code,403)
        self.assertEqual(self.api.patch(f"/api/support/tickets/{pk}/",
            {"assigned_to":self.outsider.pk},format="json").status_code,405)
        TicketMessage.objects.create(ticket_id=pk,sender=self.dns_agent,sender_role="staff",
            message="INTERNAL_ONLY_PRIVATE_NOTE",is_internal=True)
        read=self.api.get(f"/api/support/tickets/{pk}/")
        self.assertEqual(read.status_code,200,read.data)
        self.assertNotIn("INTERNAL_ONLY_PRIVATE_NOTE",str(read.data))
        self.api.force_authenticate(user=self.stranger)
        self.assertEqual(self.api.get(f"/api/support/tickets/{pk}/").status_code,404)

    def test_revoking_department_or_skill_removes_access_despite_old_assignment(self):
        result=self.create(tag=self.dns.pk)
        self.assertEqual(result.status_code,201,result.data)
        tid=result.data["id"]
        self.api.force_authenticate(self.dns_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{tid}/").status_code,200)
        self.dns.assigned_staff.remove(self.dns_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{tid}/").status_code,404)
        self.dns.assigned_staff.add(self.dns_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{tid}/").status_code,200)
        self.dept.assigned_staff.remove(self.dns_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{tid}/").status_code,404)

    def test_staff_isolation_and_admin_assignment_eligibility(self):
        r=self.create(tag=self.dns.pk)
        pk=r.data["id"]
        self.api.force_authenticate(user=self.email_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{pk}/").status_code,404)
        self.api.force_authenticate(user=self.dns_agent)
        self.assertEqual(self.api.get(f"/api/support/tickets/{pk}/").status_code,200)
        self.api.force_authenticate(user=self.admin)
        wrong=self.api.post(f"/api/support/tickets/{pk}/action/",
            {"action":"assign","staff_id":self.outsider.pk},format="json")
        self.assertEqual(wrong.status_code,400,wrong.data)
        ok=self.api.post(f"/api/support/tickets/{pk}/action/",
            {"action":"assign","staff_id":self.dns_agent.pk},format="json")
        self.assertEqual(ok.status_code,200,ok.data)

    def test_unrelated_customer_cannot_see_internal_staff_addresses(self):
        a=self.api.get("/api/support/departments/")
        b=self.api.get("/api/support/tags/")
        self.assertEqual(a.status_code,200)
        self.assertEqual(b.status_code,200)
        payload=str(a.data)+str(b.data)
        self.assertNotIn("dns-agent@example.invalid",payload)
        self.assertNotIn("assigned_staff",payload)
