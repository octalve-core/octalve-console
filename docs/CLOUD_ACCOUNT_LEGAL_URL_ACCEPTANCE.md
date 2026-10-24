# Octalve Cloud account-creation legal links — review release gate
The existing signup form linked to `https://octalve.cloud/terms-of-service`
and `https://octalve.cloud/privacy-policy`, which are inconsistent with
the owner's canonical `.com` product address and cannot be relied on if
the `.cloud` domain has not been purchased.

In this review commit the link destinations are updated to:
- `https://cloud.octalve.com/terms-of-service`
- `https://cloud.octalve.com/privacy-policy`

**Neither route is currently implemented in the public Cloud website repository.**
This commit is **not** evidence that an enforceable Octalve Cloud legal
agreement or privacy notice has been published. Obtain owner/legal approval
and publish accurate terms and privacy disclosures before inviting real users,
especially if processing their personal data.

Do not point to another Octalve product's legal agreement without confirming
that it genuinely applies to Octalve Cloud. Do not fabricate legal policies.

The account-creation browser acceptance must confirm that the actual visible
terms and privacy links open valid, approved pages.
