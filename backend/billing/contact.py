def billing_contact_snapshot(customer):
    """Capture the authenticated account's billing details at invoice issuance."""
    fields = ("full_name", "email", "phone_number", "company_name", "address",
              "city", "state", "country", "postal_code", "tax_id")
    return {field: getattr(customer, field) or "" for field in fields}
