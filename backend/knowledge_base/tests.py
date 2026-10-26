"""Knowledge publishing and access isolation."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from knowledge_base.models import KnowledgeArticle

class KnowledgeArticleAccessTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.admin=User.objects.create_user(email="kb-admin@example.invalid",
            username="kb_admin",password="CI-strong-test-secret",role="admin")
        self.staff=User.objects.create_user(email="kb-staff@example.invalid",
            username="kb_staff",password="CI-strong-test-secret",role="staff")
        self.client_user=User.objects.create_user(email="kb-client@example.invalid",
            username="kb_client",password="CI-strong-test-secret",role="client")
        self.other_staff=User.objects.create_user(email="kb-other@example.invalid",
            username="kb_other",password="CI-strong-test-secret",role="staff")
        self.api=APIClient()
        self.draft_payload={"title":"Connect your domain","category":"DNS",
            "summary":"A safe step-by-step guide.",
            "body_markdown":"## DNS settings\n- Connect a domain\n- Verify ownership",
            "visibility":"client","status":"draft"}

    def test_staff_draft_admin_publish_client_can_only_see_published(self):
        self.api.force_authenticate(self.staff)
        created=self.api.post("/api/knowledge-base/",self.draft_payload,format="json")
        self.assertEqual(created.status_code,201,created.data)
        slug=created.data["slug"]
        cannot_publish=self.api.patch(f"/api/knowledge-base/{slug}/",
            {"status":"published"},format="json")
        self.assertEqual(cannot_publish.status_code,403)
        self.api.force_authenticate(self.client_user)
        self.assertEqual(self.api.get(f"/api/knowledge-base/{slug}/").status_code,404)
        self.assertEqual(self.api.post("/api/knowledge-base/",self.draft_payload,format="json").status_code,403)
        self.api.force_authenticate(self.admin)
        approved=self.api.patch(f"/api/knowledge-base/{slug}/",
            {"status":"published"},format="json")
        self.assertEqual(approved.status_code,200,approved.data)
        self.api.force_authenticate(self.client_user)
        visible=self.api.get(f"/api/knowledge-base/{slug}/")
        self.assertEqual(visible.status_code,200,visible.data)
        self.assertIn("## DNS settings",visible.data["body_markdown"])

    def test_internal_guide_and_others_draft_never_reach_client(self):
        article=KnowledgeArticle.objects.create(
            title="Internal staff secret",category="Operations",
            summary="Internal guide",body_markdown="Do not show to customers.",
            status="published",visibility="internal",created_by=self.admin)
        self.api.force_authenticate(self.client_user)
        self.assertEqual(self.api.get(f"/api/knowledge-base/{article.slug}/").status_code,404)
        self.assertNotIn("Internal staff secret",str(self.api.get("/api/knowledge-base/").data))
        self.api.force_authenticate(self.other_staff)
        # Staff can read published internal guides, but cannot modify other authors' work.
        self.assertEqual(self.api.get(f"/api/knowledge-base/{article.slug}/").status_code,200)
        self.assertEqual(self.api.patch(f"/api/knowledge-base/{article.slug}/",
            {"title":"Unauthorized edit"},format="json").status_code,403)
