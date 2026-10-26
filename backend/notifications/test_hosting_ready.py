"""Hosting ready email contract: no insecure passwords or payment shortcuts."""
from django.test import SimpleTestCase
from notifications.hosting_ready import panel_username, HostingNoticeRefused, send_hosting_ready


class HostingNoticeContractTests(SimpleTestCase):
    def test_opanel_username_is_unique_reversible_base36(self):
        self.assertEqual(panel_username(1), "op1")
        self.assertEqual(panel_username(13), "opd")
        self.assertEqual(panel_username(36), "op10")
        self.assertNotEqual(panel_username(35), panel_username(36))
        for invalid in (None, 0, -5, 36**18, "13", 13.0, True):
            with self.subTest(invalid=invalid), self.assertRaises(HostingNoticeRefused):
                panel_username(invalid)

    def test_notice_transport_stays_disabled(self):
        with self.assertRaises(HostingNoticeRefused):
            send_hosting_ready()
