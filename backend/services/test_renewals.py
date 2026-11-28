from datetime import datetime,timezone
from unittest.mock import patch
from django.test import SimpleTestCase
from services.renewals import end_of_term,validate_policy,RenewalRefused,seal,unseal

class RenewalCalendarTests(SimpleTestCase):
    def test_month_end_anchor_survives_leap_february(self):
        start=datetime(2028,1,31,12,tzinfo=timezone.utc)
        feb=end_of_term(start,1,31)
        self.assertEqual(feb,datetime(2028,2,29,12,tzinfo=timezone.utc))
        self.assertEqual(end_of_term(feb,1,31),datetime(2028,3,31,12,tzinfo=timezone.utc))

    def test_annual_period_and_unsupported_term(self):
        start=datetime(2028,2,29,tzinfo=timezone.utc)
        self.assertEqual(end_of_term(start,12,29),datetime(2029,2,28,tzinfo=timezone.utc))
        for months in (0,2,-1,True):
            with self.assertRaises(RenewalRefused):
                end_of_term(start,months,29)

    def test_policy_requires_explicit_valid_values(self):
        p={"enabled":True,"invoice_lead_days":14,"reminder_days":7,"tax_mode":"exclusive","tax_rate":"7.50"}
        self.assertEqual(validate_policy(p),p)
        for change in ({"reminder_days":14},{"tax_rate":"NaN"},{"tax_rate":"31"},{"enabled":1},{"tax_mode":"unknown"}):
            with self.assertRaises(RenewalRefused):
                validate_policy({**p,**change})

    @patch("services.renewals.audit_keyring")
    def test_signed_term_is_context_bound_and_tamper_evident(self,keyring):
        keyring.return_value=("fixture",{"fixture":b"synthetic-unit-test-only"})
        value=seal({"term":"2028-01-31","total":"1000.00"},"renewal")
        self.assertEqual(unseal(value,"renewal")["total"],"1000.00")
        with self.assertRaises(RenewalRefused):
            unseal(value,"policy")
        value["payload"]["total"]="1.00"
        with self.assertRaises(RenewalRefused):
            unseal(value,"renewal")
