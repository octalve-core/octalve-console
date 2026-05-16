# Octalve Console — Backend Database Architecture

## Purpose

This document describes the recommended backend database architecture for Octalve Console.

It is written for a Django/DRF backend and includes current MVP tables plus future-ready tables for hosting automation, domains, billing, wallet, support, knowledge base, providers, settings, audit logs and RBAC roles.

The backend developer specifically noted that roles were not previously added. This architecture includes roles, permissions and user-role mapping.

---

## Core backend principles

1. Backend is the source of truth.
2. Frontend should fetch products, plans, prices, services, invoices, wallet, domains, tickets and settings through API.
3. Provider calls must be queue-first, not checkout-request-first.
4. Payment confirmation must come from verified gateway webhook.
5. Provisioning must happen after payment confirmation.
6. Every important action should create an audit log.
7. Secrets must be encrypted at rest.
8. Users must only access pages and resources permitted by their role.

---

## Recommended Django apps

```txt
backend/apps/
  accounts/
  roles/
  catalog/
  orders/
  billing/
  payments/
  wallet/
  services/
  domains/
  providers/
  provisioning/
  support/
  knowledge_base/
  settings_registry/
  notifications/
  audit/
  tools/
```

---

## 1. Accounts and RBAC

### users

Stores all admin, staff and client users.

```txt
id
email
password_hash
full_name
phone
avatar_url
status
is_active
is_email_verified
last_login_at
created_at
updated_at
```

### roles

Required because roles were not previously handled.

```txt
id
key
name
description
is_system
created_at
updated_at
```

Initial role keys:

```txt
admin
staff
client
```

Possible future roles:

```txt
super_admin
billing_manager
support_agent
provisioning_agent
sales_agent
customer
```

### permissions

Granular permission registry.

```txt
id
key
name
module
description
created_at
updated_at
```

Examples:

```txt
view_customers
create_customers
update_customers
delete_customers
view_invoices
create_invoices
update_invoices
delete_invoices
view_services
provision_services
suspend_services
terminate_services
view_tickets
reply_tickets
manage_settings
manage_providers
view_audit_logs
```

### role_permissions

Many-to-many between roles and permissions.

```txt
id
role_id
permission_id
created_at
```

### user_roles

Many-to-many between users and roles.

```txt
id
user_id
role_id
created_at
```

### client_profiles

Client-specific profile extension.

```txt
id
user_id
company_name
billing_email
address
city
state
country
tax_id
created_at
updated_at
```

### staff_profiles

Staff-specific profile extension.

```txt
id
user_id
department
job_title
can_be_assigned_tickets
can_handle_provisioning
created_at
updated_at
```

---

## 2. Catalog: Products and Plans

### product_categories

```txt
id
name
slug
description
sort_order
is_active
created_at
updated_at
```

Examples:

```txt
Hosting
Domains
Email
WordPress
Security
VPS
Backups
Migration
```

### products

```txt
id
category_id
name
slug
description
product_type
status
is_public
sort_order
created_at
updated_at
```

Product types:

```txt
shared_hosting
wordpress_hosting
vps
domain
ssl
email
backup
migration
custom
```

### plans

```txt
id
product_id
name
slug
description
currency
base_price
billing_cycle
status
is_public
is_popular
sort_order
created_at
updated_at
```

### plan_features

```txt
id
plan_id
label
value
sort_order
is_highlighted
created_at
updated_at
```

### plan_billing_cycles

```txt
id
plan_id
cycle_key
label
months
price
regular_price
discount_percent
setup_fee
is_active
created_at
updated_at
```

Examples:

```txt
1mo
3mo
6mo
12mo
24mo
48mo
```

### plan_provider_mappings

Maps Octalve plans to provider packages.

```txt
id
plan_id
provider_id
adapter_type
provider_package_id
provider_package_name
server_group
metadata_json
is_active
created_at
updated_at
```

Important: client should not see this. It is internal.

---

## 3. Orders

### orders

```txt
id
order_number
client_id
status
currency
subtotal
discount_total
tax_total
total
source
notes
created_at
updated_at
```

Statuses:

```txt
draft
pending_payment
paid
ready_for_provisioning
provisioning
provisioned
cancelled
failed
needs_review
```

### order_items

```txt
id
order_id
product_id
plan_id
domain_name
item_type
description
quantity
unit_price
cycle_key
months
subtotal
metadata_json
created_at
updated_at
```

### coupons

```txt
id
code
name
discount_type
discount_value
max_uses
used_count
starts_at
ends_at
is_active
created_at
updated_at
```

### coupon_redemptions

```txt
id
coupon_id
order_id
client_id
discount_amount
created_at
```

---

## 4. Billing and invoices

### invoices

```txt
id
invoice_number
client_id
order_id
status
currency
subtotal
discount_total
tax_total
total
amount_paid
amount_due
issue_date
due_date
paid_at
created_at
updated_at
```

Statuses:

```txt
draft
unpaid
partially_paid
paid
overdue
void
cancelled
refunded
```

### invoice_items

```txt
id
invoice_id
description
product_id
plan_id
service_id
domain_id
quantity
unit_price
subtotal
tax_amount
total
metadata_json
created_at
updated_at
```

### transactions

```txt
id
client_id
invoice_id
gateway_id
reference
provider_reference
transaction_type
status
currency
amount
fee
net_amount
paid_at
metadata_json
created_at
updated_at
```

Transaction statuses:

```txt
pending
successful
failed
cancelled
refunded
manual_review
```

### quotes

```txt
id
quote_number
client_id
status
currency
subtotal
tax_total
discount_total
total
valid_until
created_at
updated_at
```

### taxes

```txt
id
name
rate
country
state
is_inclusive
is_active
created_at
updated_at
```

---

## 5. Payment gateways

### payment_gateways

```txt
id
code
name
status
test_mode
public_key
encrypted_secret_key
encrypted_webhook_secret
metadata_json
created_at
updated_at
```

Gateway codes:

```txt
paystack
flutterwave
bank_transfer
wallet
manual
crypto
```

### payment_intents

```txt
id
invoice_id
client_id
gateway_id
reference
authorization_url
status
amount
currency
metadata_json
created_at
updated_at
```

### payment_webhook_events

```txt
id
gateway_id
event_id
event_type
payload_json
headers_json
is_verified
processed_at
created_at
```

---

## 6. Wallet

### wallets

```txt
id
client_id
currency
balance
is_active
created_at
updated_at
```

### wallet_ledger

```txt
id
wallet_id
client_id
transaction_type
amount
balance_before
balance_after
description
reference
invoice_id
created_by_id
created_at
```

Transaction types:

```txt
credit
debit
deposit
invoice_payment
refund
manual_adjustment
```

### wallet_settings

```txt
id
client_id
auto_pay_enabled
minimum_balance_alert
created_at
updated_at
```

---

## 7. Services

### services

```txt
id
client_id
order_item_id
product_id
plan_id
provider_id
domain_name
label
status
billing_cycle
amount
next_due_date
activated_at
suspended_at
terminated_at
metadata_json
created_at
updated_at
```

Statuses:

```txt
pending
active
suspended
cancelled
terminated
failed
pending_migration
```

### service_credentials

Encrypted service login/control panel details.

```txt
id
service_id
username
encrypted_password
login_url
metadata_json
created_at
updated_at
```

### service_usage_snapshots

```txt
id
service_id
disk_used
disk_limit
bandwidth_used
bandwidth_limit
email_used
email_limit
database_used
database_limit
cpu_percent
memory_percent
raw_json
created_at
```

### service_actions

Tracks actions requested by client/admin/staff.

```txt
id
service_id
action
requested_by_id
status
reason
metadata_json
created_at
updated_at
```

Actions:

```txt
provision
suspend
unsuspend
terminate
renew
change_password
change_package
start
stop
reboot
request_migration
```

---

## 8. Provisioning queue

### provisioning_tasks

```txt
id
service_id
order_id
order_item_id
provider_id
adapter_type
action
status
attempt_count
max_attempts
last_error
scheduled_at
started_at
completed_at
metadata_json
created_at
updated_at
```

Statuses:

```txt
queued
running
completed
failed
retrying
cancelled
needs_review
configuration_error
```

### provider_request_logs

```txt
id
provider_id
service_id
task_id
action
request_json_redacted
response_json_redacted
status_code
success
duration_ms
created_at
```

---

## 9. Providers and adapters

### providers

```txt
id
name
adapter_type
base_url
username
encrypted_api_key
encrypted_secret
server_group
status
test_mode
health_status
last_health_check_at
metadata_json
created_at
updated_at
```

Adapter types:

```txt
DirectAdminAdapter
CpanelAdapter
PleskAdapter
VirtualizorAdapter
ProxmoxAdapter
EnhanceAdapter
PterodactylAdapter
VirtFusionAdapter
CloudflareAdapter
DomainRegistrarAdapter
SslProviderAdapter
EmailProviderAdapter
BackupProviderAdapter
CustomProviderAdapter
```

### provider_packages

Optional sync table for packages fetched from DirectAdmin/cPanel/VPS providers.

```txt
id
provider_id
provider_package_id
name
description
raw_json
is_active
last_synced_at
created_at
updated_at
```

---

## 10. Domains and DNS

### domains

```txt
id
client_id
order_item_id
provider_id
domain_name
status
registration_type
expiry_date
next_due_date
auto_renew
epp_code_encrypted
metadata_json
created_at
updated_at
```

Registration types:

```txt
register
transfer
existing
internal
```

### domain_nameservers

```txt
id
domain_id
hostname
sort_order
created_at
updated_at
```

### dns_records

```txt
id
domain_id
record_type
name
value
ttl
priority
status
provider_record_id
created_at
updated_at
```

Record types:

```txt
A
AAAA
CNAME
MX
TXT
SRV
CAA
NS
```

### domain_search_logs

```txt
id
client_id
query
tld
available
price
provider_response_json
created_at
```

---

## 11. SSL certificates

### ssl_certificates

```txt
id
client_id
service_id
domain_id
provider_id
certificate_type
status
issued_at
expires_at
auto_renew
metadata_json
created_at
updated_at
```

---

## 12. Email services

### email_services

```txt
id
client_id
service_id
domain_id
provider_id
status
mailbox_limit
storage_limit
created_at
updated_at
```

### mailboxes

```txt
id
email_service_id
email
display_name
quota_mb
status
created_at
updated_at
```

---

## 13. Backups

### backup_services

```txt
id
client_id
service_id
provider_id
status
retention_days
schedule
last_backup_at
created_at
updated_at
```

### backup_snapshots

```txt
id
backup_service_id
snapshot_reference
status
size_mb
created_at
restored_at
```

---

## 14. Support tickets

### support_departments

```txt
id
name
email
description
is_active
created_at
updated_at
```

### support_tickets

```txt
id
ticket_number
client_id
department_id
assigned_to_id
subject
priority
status
created_at
updated_at
closed_at
```

Statuses:

```txt
open
waiting_customer
waiting_staff
in_progress
on_hold
closed
trash
```

### support_ticket_messages

```txt
id
ticket_id
sender_id
message
is_internal
created_at
updated_at
```

### support_ticket_attachments

```txt
id
message_id
file
filename
mime_type
size
created_at
```

### predefined_responses

```txt
id
department_id
title
body
is_active
created_at
updated_at
```

---

## 15. Knowledge base

### knowledge_categories

```txt
id
name
slug
description
sort_order
is_active
created_at
updated_at
```

### knowledge_articles

```txt
id
category_id
author_id
title
slug
excerpt
content_html
content_json
status
visibility
views
likes
seo_title
seo_description
published_at
created_at
updated_at
```

Statuses:

```txt
draft
published
unpublished
archived
```

Visibility:

```txt
public
client
staff
internal
```

### knowledge_article_revisions

```txt
id
article_id
editor_id
content_html
content_json
change_note
created_at
```

---

## 16. Settings registry

### settings_groups

```txt
id
key
name
description
sort_order
created_at
updated_at
```

Groups:

```txt
general
security
social-login
tax
mail
tickets
cron-jobs
credits
theme
invoices
other
providers
api-keys
notifications
```

### settings

```txt
id
group_id
key
value_json
is_encrypted
created_at
updated_at
```

---

## 17. Notifications and email templates

### notification_templates

```txt
id
key
name
event_type
channel
subject
body_html
body_text
variables_schema
enabled
created_at
updated_at
```

Channels:

```txt
email
system
sms
whatsapp
```

### notification_logs

```txt
id
template_id
recipient_user_id
recipient_email
channel
subject
status
error_message
sent_at
created_at
```

---

## 18. API keys

### api_keys

```txt
id
name
key_prefix
hashed_key
created_by_id
status
allowed_ips_json
last_used_at
expires_at
created_at
updated_at
```

### api_key_permissions

```txt
id
api_key_id
permission_id
created_at
```

---

## 19. Audit logs

### audit_logs

```txt
id
actor_id
actor_email
actor_role
action
entity_type
entity_id
details
ip_address
user_agent
metadata_json
created_at
```

Audit everything important:

```txt
login
logout
create_order
create_invoice
payment_submitted
payment_confirmed
provisioning_queued
service_provisioned
service_suspended
service_unsuspended
service_terminated
domain_updated
dns_record_updated
settings_updated
ticket_created
ticket_replied
wallet_credited
wallet_debited
```

---

## 20. Admin tools

The current frontend has tool pages. Backend can create a future `tools` app.

### blacklist_rules

```txt
id
rule_type
value
reason
status
created_by_id
created_at
updated_at
```

Rule types:

```txt
ip
cidr
email
domain
client
```

### downloads

```txt
id
title
file
visibility
status
created_at
updated_at
```

### cms_pages

```txt
id
title
slug
content_html
status
visibility
created_at
updated_at
```

### currencies

```txt
id
code
name
symbol
exchange_rate
is_default
is_active
updated_at
```

### mass_mail_campaigns

```txt
id
title
subject
body_html
status
created_by_id
sent_at
created_at
updated_at
```

---

## Immediate backend build priority

Recommended order:

```txt
1. Auth + users + roles + permissions
2. Products, plans, billing cycles and provider mapping
3. Orders and invoices
4. Payment gateways and Paystack test integration
5. Webhook verification
6. Provisioning queue
7. DirectAdmin provider adapter
8. Services and service usage
9. Domains and DNS records
10. Wallet
11. Support tickets
12. Knowledge base
13. Settings registry
14. Notification templates
15. Audit logs
```

---

## Important implementation note

The frontend can hide pages by role, but the backend must enforce authorization. Never rely on frontend-only protection.

Every API should check:

```txt
user is authenticated
user has correct role
user has required permission
user owns the resource if client
staff has assigned scope if staff
admin can manage according to permission
```

---

## Environment variables expected

```txt
DJANGO_SECRET_KEY
DATABASE_URL
REDIS_URL
PAYSTACK_PUBLIC_KEY
PAYSTACK_SECRET_KEY
PAYSTACK_WEBHOOK_SECRET
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_WEBHOOK_SECRET
DIRECTADMIN_BASE_URL
DIRECTADMIN_USERNAME
DIRECTADMIN_API_KEY
EMAIL_HOST
EMAIL_PORT
EMAIL_HOST_USER
EMAIL_HOST_PASSWORD
DEFAULT_FROM_EMAIL
```

Secrets must not be committed to GitHub.
