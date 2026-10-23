# Octalve Cloud — initial Neon Preview migration plan (read-only evidence)

**Date:** 2026-10-23  
**Source revision:** `5b5826e9564281bf9e78af152319005e7c748f07` (foundation PR #3)  
**Neon project:** `octalve-cloud-review-db` (`falling-surf-50258433`)  
**Database branch:** `preview/review/cloud-foundation-qualification` (`br-wild-field-b88w1xq5`)  
**Database name:** `neondb`  
**Command:** `python manage.py migrate --plan` with Django on Python 3.12.14 using a temporary runner, connected to this Neon branch.  
**Result:** exit 0, 36 unapplied migrations, 200 listed operations. `public.django_migrations` absent and zero tables before running.  
**Plan SHA-256:** `80b1813003a779ffb314085caec5402cafb7cc96dd87cb1c7cbde1f154e57a20`.

**This file is evidence of planning, not approval to apply.** `migrate --plan` does not execute schema migrations. Django's actual PostgreSQL-specific DDL must be generated/reviewed where needed; this operation listing is not a complete SQL transcript. A safe preflight and independently protected schema operation remain required. Never run against Neon's default/production branch.

## Complete Django operation listing

```text
Planned operations:
contenttypes.0001_initial
    Create model ContentType
    Alter unique_together for contenttype (1 constraint(s))
contenttypes.0002_remove_content_type_name
    Change Meta options on contenttype
    Alter field name on contenttype
    Raw Python operation
    Remove field name from contenttype
auth.0001_initial
    Create model Permission
    Create model Group
    Create model User
auth.0002_alter_permission_name_max_length
    Alter field name on permission
auth.0003_alter_user_email_max_length
    Alter field email on user
auth.0004_alter_user_username_opts
    Alter field username on user
auth.0005_alter_user_last_login_null
    Alter field last_login on user
auth.0006_require_contenttypes_0002
auth.0007_alter_validators_add_error_messages
    Alter field username on user
auth.0008_alter_user_username_max_length
    Alter field username on user
auth.0009_alter_user_last_name_max_length
    Alter field last_name on user
auth.0010_alter_group_name_max_length
    Alter field name on group
auth.0011_update_proxy_permissions
    Raw Python operation ->     Update the content_type of prox…
auth.0012_alter_user_first_name_max_length
    Alter field first_name on user
accounts.0001_initial
    Create model CustomUser
    Create model ClientProfile
    Create model LoginHistory
    Create model StaffProfile
    Create index accounts_cu_email_5ce40b_idx on field(s) email of model customuser
    Create index accounts_cu_role_666d59_idx on field(s) role of model customuser
    Create index accounts_cu_referra_4d2021_idx on field(s) referral_code of model customuser
    Create index accounts_cu_date_jo_36131c_idx on field(s) -date_joined of model customuser
accounts.0002_staffprofile_notes
    Add field notes to staffprofile
admin.0001_initial
    Create model LogEntry
admin.0002_logentry_remove_auto_add
    Alter field action_time on logentry
admin.0003_logentry_add_action_flag_choices
    Alter field action_flag on logentry
audit.0001_initial
    Create model LoginAttempt
    Create model SystemHealthLog
    Create model APIAccessLog
    Create model AuditLog
    Create model DataExportLog
    Create model SecurityEvent
orders.0001_initial
    Create model Coupon
    Create model Order
    Create model CouponRedemption
    Create model OrderItem
    Create model Cart
    Create index orders_orde_order_n_f3ada5_idx on field(s) order_number of model order
    Create index orders_orde_client__7fa500_idx on field(s) client, status of model order
    Create index orders_orde_status_25e057_idx on field(s) status, created_at of model order
    Create index orders_orde_created_f0ce29_idx on field(s) -created_at of model order
    Create index orders_coup_coupon__ca489b_idx on field(s) coupon, client of model couponredemption
    Alter unique_together for couponredemption (1 constraint(s))
    Create index orders_orde_order_i_af7cd1_idx on field(s) order, item_type of model orderitem
    Create index orders_orde_product_611f6e_idx on field(s) product_id, plan_id of model orderitem
billing.0001_initial
    Create model Invoice
    Create model InvoiceItem
    Create model Quote
    Create model Tax
    Create index billing_inv_invoice_70511c_idx on field(s) invoice_number of model invoice
    Create index billing_inv_client__85c90b_idx on field(s) client, status of model invoice
    Create index billing_inv_due_dat_7d5547_idx on field(s) due_date, status of model invoice
    Create index billing_inv_issue_d_4aed66_idx on field(s) -issue_date of model invoice
    Create index billing_inv_invoice_563f13_idx on field(s) invoice of model invoiceitem
    Create index billing_inv_service_fb3a89_idx on field(s) service_id of model invoiceitem
    Create index billing_quo_quote_n_15b6ba_idx on field(s) quote_number of model quote
    Create index billing_quo_client__b228d1_idx on field(s) client, status of model quote
catalog.0001_initial
    Create model Product
    Create model Plan
    Create model ProductCategory
    Add field category to product
    Create model PlanBillingCycle
    Create model PlanFeature
    Create model PlanProviderMapping
    Create index catalog_pla_slug_3aa707_idx on field(s) slug of model plan
    Create index catalog_pla_status_45d24a_idx on field(s) status of model plan
    Create index catalog_pla_is_popu_1d3bc8_idx on field(s) is_popular of model plan
    Alter unique_together for plan (1 constraint(s))
    Create index catalog_pro_slug_2b1eb6_idx on field(s) slug of model product
    Create index catalog_pro_product_9ecdd3_idx on field(s) product_type of model product
    Create index catalog_pro_status_521020_idx on field(s) status of model product
services.0001_initial
    Create model Service
    Create model ServiceActionLog
    Create model ServiceChangeRequest
    Create model ServiceCredential
    Create model ServiceSuspension
    Create model ServiceUsage
    Create index services_se_client__ef5178_idx on field(s) client, status of model service
    Create index services_se_provide_a29a19_idx on field(s) provider_identifier of model service
    Create index services_se_next_du_b11680_idx on field(s) next_due_date of model service
    Create index services_se_domain__1d458f_idx on field(s) domain_name of model service
    Create index services_se_service_9fa833_idx on field(s) service_type of model service
    Create index services_se_service_e8edbd_idx on field(s) service, -created_at of model serviceactionlog
    Create index services_se_action_c31f3d_idx on field(s) action of model serviceactionlog
    Create index services_se_service_58cc8d_idx on field(s) service of model servicecredential
    Create index services_se_service_674fae_idx on field(s) service, -recorded_at of model serviceusage
providers.0001_initial
    Create model Provider
    Create model ProviderHealthCheck
    Create model ProviderLog
    Create model ProviderPackage
domains.0001_initial
    Create model TLDPricing
    Create model Domain
    Create model DNSRecord
    Create model DomainNameserver
    Create model DomainSearchLog
    Create model SSLCertificate
    Create index domains_dom_domain__5fc12f_idx on field(s) domain_name of model domain
    Create index domains_dom_client__cba094_idx on field(s) client, status of model domain
    Create index domains_dom_expiry__9c12df_idx on field(s) expiry_date of model domain
    Create index domains_dom_tld_08e052_idx on field(s) tld of model domain
    Create index domains_dns_domain__022a42_idx on field(s) domain, record_type of model dnsrecord
    Create index domains_dns_domain__cb7749_idx on field(s) domain, name of model dnsrecord
    Alter unique_together for domainnameserver (1 constraint(s))
    Create index domains_dom_query_ba1359_idx on field(s) query, searched_at of model domainsearchlog
    Create index domains_dom_client__f37699_idx on field(s) client of model domainsearchlog
    Create index domains_ssl_client__0a328c_idx on field(s) client, status of model sslcertificate
    Create index domains_ssl_expires_3ddc89_idx on field(s) expires_at of model sslcertificate
    Create index domains_ssl_common__e93876_idx on field(s) common_name of model sslcertificate
payments.0001_initial
    Create model PaymentGateway
    Create model PaymentIntent
    Create model Transaction
    Create model WebhookEvent
provisioning.0001_initial
    Create model ProvisioningQueue
    Create model ProvisioningWebhook
    Create model ProvisioningTask
    Create model ProvisioningLog
    Create model WebhookDelivery
    Create index provisionin_status_4a144d_idx on field(s) status, scheduled_at of model provisioningtask
    Create index provisionin_service_c5e83f_idx on field(s) service, status of model provisioningtask
    Create index provisionin_provide_a3144d_idx on field(s) provider, status of model provisioningtask
    Create index provisionin_lock_ke_ccbfc0_idx on field(s) lock_key of model provisioningtask
    Create index provisionin_created_367aa6_idx on field(s) -created_at of model provisioningtask
    Create index provisionin_task_id_6ae765_idx on field(s) task, -created_at of model provisioninglog
    Create index provisionin_log_lev_08c20f_idx on field(s) log_level of model provisioninglog
    Create index provisionin_webhook_8397f1_idx on field(s) webhook, success of model webhookdelivery
    Create index provisionin_task_id_aa8e58_idx on field(s) task of model webhookdelivery
rbac.0001_initial
    Create model Permission
    Create model Role
    Create model RolePermission
    Create model UserRole
    Create index rbac_role_key_4ec997_idx on field(s) key of model role
    Create index rbac_role_is_acti_5a2fc4_idx on field(s) is_active of model role
    Create index rbac_rolepe_role_id_4acee1_idx on field(s) role, permission of model rolepermission
    Alter unique_together for rolepermission (1 constraint(s))
    Create index rbac_userro_user_id_f47914_idx on field(s) user, role of model userrole
    Alter unique_together for userrole (1 constraint(s))
reports.0001_initial
    Create model DashboardWidget
    Create model Metric
    Create model ReportDefinition
    Create model ReportInstance
    Create model SavedReportFilter
    Create model MetricHistory
    Create index reports_rep_report__ead09f_idx on field(s) report_type of model reportdefinition
    Create index reports_rep_is_acti_f2fb13_idx on field(s) is_active of model reportdefinition
    Create index reports_rep_next_ge_05ff6a_idx on field(s) next_generation_at of model reportdefinition
    Create index reports_rep_definit_deb9d0_idx on field(s) definition, -generated_at of model reportinstance
    Create index reports_rep_status_419368_idx on field(s) status of model reportinstance
    Create index reports_rep_generat_5221f8_idx on field(s) generated_by of model reportinstance
    Create index reports_rep_period__d84b2c_idx on field(s) period_start, period_end of model reportinstance
    Alter unique_together for savedreportfilter (1 constraint(s))
sessions.0001_initial
    Create model Session
settings_registry.0001_initial
    Create model BrandingSettings
    Create model SystemConfig
    Create model TaxSettings
    Create model EmailTemplate
    Create model SettingGroup
    Create model Setting
    Create model SettingChangeLog
    Create index settings_re_group_i_686121_idx on field(s) group, key of model setting
    Create index settings_re_is_publ_17007c_idx on field(s) is_public of model setting
    Create index settings_re_is_depr_8a5a43_idx on field(s) is_deprecated of model setting
    Alter unique_together for setting (1 constraint(s))
sites.0001_initial
    Create model Site
sites.0002_alter_domain_unique
    Alter field domain on site
support.0001_initial
    Create model SupportDepartment
    Create model PredefinedResponse
    Create model SupportTicket
    Create model TicketEscalationRule
    Create model TicketMessage
    Create model TicketAttachment
    Create model TicketSurvey
    Create index support_sup_slug_f33aba_idx on field(s) slug of model supportdepartment
    Create index support_sup_is_acti_f1c26b_idx on field(s) is_active of model supportdepartment
    Create index support_pre_shortcu_dca0e0_idx on field(s) shortcut of model predefinedresponse
    Create index support_pre_departm_a20cdb_idx on field(s) department, is_active of model predefinedresponse
    Create index support_sup_ticket__4a7d4b_idx on field(s) ticket_number of model supportticket
    Create index support_sup_client__068cd5_idx on field(s) client, status of model supportticket
    Create index support_sup_assigne_87974a_idx on field(s) assigned_to, status of model supportticket
    Create index support_sup_priorit_19dd91_idx on field(s) priority, status of model supportticket
    Create index support_sup_created_f4f0fe_idx on field(s) -created_at of model supportticket
    Create index support_tic_ticket__0cd9bd_idx on field(s) ticket, created_at of model ticketmessage
    Create index support_tic_sender__b55eeb_idx on field(s) sender_role, is_read of model ticketmessage
wallet.0001_initial
    Create model Wallet
    Create model WalletLedger
    Create model WithdrawalRequest
    Create model DepositRequest
    Create index wallet_wall_user_id_03e396_idx on field(s) user of model wallet
    Create index wallet_wall_balance_1ea64d_idx on field(s) balance of model wallet
    Create index wallet_wall_wallet__c68e83_idx on field(s) wallet, -created_at of model walletledger
    Create index wallet_wall_user_id_001617_idx on field(s) user, -created_at of model walletledger
    Create index wallet_wall_transac_dcdb55_idx on field(s) transaction_type of model walletledger
    Create index wallet_wall_referen_a9e04d_idx on field(s) reference of model walletledger
    Create index wallet_wall_invoice_a3c6e1_idx on field(s) invoice_id of model walletledger
    Create index wallet_with_user_id_03c7c7_idx on field(s) user, status of model withdrawalrequest
    Create index wallet_with_referen_9e3e07_idx on field(s) reference of model withdrawalrequest
```

## Acceptance before applying

- Owner explicitly approves the **36 migrations** targeting only `br-wild-field-b88w1xq5`.
- Reconfirm branch identity, TLS, zero existing tables, direct (nonpooler) migration connection and maintenance window.
- Confirm Neon snapshot/PITR or equivalent recovery mechanism and migration reversal limits.
- Apply **once** using the approved guarded runner or a separately audited engineering tool, not a browser action or serverless startup.
- Verify `django_migrations`, account creation and cross-user permissions after applying.
