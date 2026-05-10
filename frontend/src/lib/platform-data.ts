// src/lib/platform-data.ts
export type StatusTone = "green" | "orange" | "red" | "dark";

export const adapters = [
  { name: "DirectAdminAdapter", category: "Hosting", status: "Ready", tone: "green" as StatusTone, description: "Provision shared hosting accounts, suspend, unsuspend, terminate, change package and fetch usage." },
  { name: "CpanelAdapter", category: "Hosting", status: "Planned", tone: "orange" as StatusTone, description: "Future cPanel/WHM provisioning adapter for shared and reseller hosting." },
  { name: "PleskAdapter", category: "Hosting", status: "Planned", tone: "orange" as StatusTone, description: "Future Plesk adapter for Windows/Linux hosting plans." },
  { name: "VirtualizorAdapter", category: "VPS", status: "Planned", tone: "orange" as StatusTone, description: "VPS creation, suspension, bandwidth and power actions through Virtualizor." },
  { name: "ProxmoxAdapter", category: "VPS", status: "Ready contract", tone: "green" as StatusTone, description: "VM lifecycle adapter for Proxmox clusters, templates and resource usage." },
  { name: "EnhanceAdapter", category: "Hosting", status: "Planned", tone: "orange" as StatusTone, description: "Modern multi-server hosting panel adapter for future shared hosting growth." },
  { name: "PterodactylAdapter", category: "Game servers", status: "Planned", tone: "orange" as StatusTone, description: "Game server provisioning and server power management." },
  { name: "VirtFusionAdapter", category: "VPS", status: "Planned", tone: "orange" as StatusTone, description: "VPS lifecycle automation through VirtFusion." },
  { name: "CloudflareAdapter", category: "DNS", status: "Ready contract", tone: "green" as StatusTone, description: "DNS zone, records, SSL mode and proxy management." },
  { name: "DomainRegistrarAdapter", category: "Domains", status: "Ready contract", tone: "green" as StatusTone, description: "Domain search, register, transfer, renew, nameserver and EPP automation." },
  { name: "SslProviderAdapter", category: "SSL", status: "Ready contract", tone: "green" as StatusTone, description: "Issue, renew and install SSL certificates." },
  { name: "EmailProviderAdapter", category: "Email", status: "Ready contract", tone: "green" as StatusTone, description: "Mailbox, forwarding, quota and email service automation." },
  { name: "BackupProviderAdapter", category: "Backups", status: "Ready contract", tone: "green" as StatusTone, description: "Backup plan assignment, restore request and retention visibility." },
  { name: "CustomProviderAdapter", category: "Custom", status: "Ready contract", tone: "green" as StatusTone, description: "Fallback adapter for internal or custom API providers." }
];

export const gateways = [
  { id: "paystack", name: "Paystack", summary: "Accept cards, bank transfers and USSD in Nigeria.", status: "Test", tone: "orange" as StatusTone, fields: ["Display Name", "Public Key", "Secret Key", "Webhook Secret", "Test Mode"] },
  { id: "flutterwave", name: "Flutterwave", summary: "Pan-African payment gateway for cards, bank transfer and mobile money.", status: "Test", tone: "orange" as StatusTone, fields: ["Display Name", "Public Key", "Secret Key", "Encryption Key", "Webhook Secret", "Test Mode"] },
  { id: "crypto", name: "Cryptocurrency", summary: "Accept USDT, BTC, ETH and other future crypto payments.", status: "Disabled", tone: "dark" as StatusTone, fields: ["Display Name", "Provider", "Wallet Addresses", "Confirmation Rules"] },
  { id: "bank-transfer", name: "Bank Transfer", summary: "Manual bank transfers with admin confirmation.", status: "Active", tone: "green" as StatusTone, fields: ["Display Name", "Bank Name", "Account Name", "Account Number", "Instructions"] },
  { id: "wallet", name: "Wallet Balance", summary: "Allow customers pay invoices from Octalve Cloud wallet balance.", status: "Disabled", tone: "dark" as StatusTone, fields: ["Display Name", "Auto-use credits", "Minimum balance"] },
  { id: "manual", name: "Manual Payment", summary: "Admin-confirmed offline payments for special clients or bank receipts.", status: "Active", tone: "green" as StatusTone, fields: ["Display Name", "Instructions", "Receipt Required"] }
];

export const products = [
  { id: "PRD-HOST", name: "Web Hosting", category: "Hosting", adapter: "DirectAdminAdapter", status: "Active", description: "Shared hosting plans with DirectAdmin, SSL, email, databases and backups." },
  { id: "PRD-VPS", name: "VPS Hosting", category: "Servers", adapter: "ProxmoxAdapter", status: "Planned", description: "Virtual private servers with power actions, usage and snapshots." },
  { id: "PRD-DOM", name: "Domain Registration", category: "Domains", adapter: "DomainRegistrarAdapter", status: "Active", description: "Domain registration, transfer, renewal and nameserver management." },
  { id: "PRD-SSL", name: "SSL Certificates", category: "Security", adapter: "SslProviderAdapter", status: "Active", description: "SSL certificate ordering, renewal and installation." },
  { id: "PRD-EMAIL", name: "Business Email", category: "Email", adapter: "EmailProviderAdapter", status: "Planned", description: "Mailbox hosting, forwarding, quotas and email security." },
  { id: "PRD-BACKUP", name: "Cloud Backups", category: "Backups", adapter: "BackupProviderAdapter", status: "Planned", description: "Website, server and database backups with restore workflow." }
];

export const plans = [
  { id: "starter", name: "Starter", product: "Web Hosting", currency: "NGN", price: 1500, cycle: "mo", storage: "10 GB", bandwidth: "100 GB", websites: "1 site", emails: "5", databases: "3", ssl: true, popular: false, adapter: "DirectAdminAdapter", features: ["DirectAdmin control panel", "Free SSL", "5 email accounts", "3 databases", "Weekly backup option"], cycles: [{label:"1 Month", price:1500}, {label:"3 Months", price:4200}, {label:"6 Months", price:8000}, {label:"12 Months", price:15000}] },
  { id: "business", name: "Business", product: "Web Hosting", currency: "NGN", price: 3500, cycle: "mo", storage: "50 GB", bandwidth: "500 GB", websites: "10 sites", emails: "25", databases: "10", ssl: true, popular: true, adapter: "DirectAdminAdapter", features: ["10 websites", "Free SSL", "25 email accounts", "Priority migration", "Daily backup option"], cycles: [{label:"1 Month", price:3500}, {label:"3 Months", price:9900}, {label:"6 Months", price:19000}, {label:"12 Months", price:38000}] },
  { id: "vps-1", name: "VPS-1", product: "VPS Hosting", currency: "NGN", price: 12000, cycle: "mo", storage: "50 GB", bandwidth: "2000 GB", websites: "Unlimited", emails: "-", databases: "-", ssl: true, popular: false, adapter: "ProxmoxAdapter", features: ["1 vCPU", "2 GB RAM", "50 GB SSD", "Root access", "Snapshot-ready architecture"], cycles: [{label:"1 Month", price:12000}, {label:"3 Months", price:34000}, {label:"6 Months", price:66000}, {label:"12 Months", price:128000}] },
  { id: "domain-com", name: ".com Domain", product: "Domain Registration", currency: "NGN", price: 0, cycle: "yr", storage: "-", bandwidth: "-", websites: "1 domain", emails: "DNS optional", databases: "-", ssl: false, popular: true, adapter: "DomainRegistrarAdapter", features: ["Registration", "Transfer", "Renewal", "Nameserver management", "EPP code workflow"], cycles: [{label:"1 Year", price:24000}, {label:"2 Years", price:48000}, {label:"Transfer", price:22000}, {label:"Renew", price:26000}] },
  { id: "ssl-free", name: "Free SSL", product: "SSL Certificates", currency: "NGN", price: 0, cycle: "mo", storage: "-", bandwidth: "-", websites: "1 domain", emails: "-", databases: "-", ssl: true, popular: false, adapter: "SslProviderAdapter", features: ["Domain validation", "Auto renewal support", "Install through hosting adapter"], cycles: [{label:"1 Month", price:0}, {label:"3 Months", price:0}, {label:"6 Months", price:0}, {label:"12 Months", price:0}] }
];

export const customers = [
  { id: "CUST-1500", name: "Brand De", email: "hellobrandde@gmail.com", phone: "0813 575 0956", status: "Active", balance: "â‚¦0", services: 2, invoices: 3 },
  { id: "CUST-1501", name: "Octalve Demo Client", email: "client@example.com", phone: "0800 000 0000", status: "Active", balance: "â‚¦3,500", services: 1, invoices: 1 }
];

export const services = [
  { id: "SERVICE-ID", customer: "Brand De", package: "Business", product: "Web Hosting", label: "example.com", term: "1 Month @ â‚¦3,500", renews: "May 30, 2026", status: "Active", adapter: "DirectAdminAdapter", usage: { disk: 38, bandwidth: 24, email: 42, database: 17 } },
  { id: "SVC-VPS-001", customer: "Brand De", package: "VPS-1", product: "VPS Hosting", label: "api.example.com", term: "1 Month @ â‚¦12,000", renews: "May 30, 2026", status: "Pending", adapter: "ProxmoxAdapter", usage: { disk: 12, bandwidth: 9, cpu: 18, memory: 44 } },
  { id: "SVC-DOM-001", customer: "Octalve Demo Client", package: ".com Domain", product: "Domain Registration", label: "octalvedemo.com", term: "1 Year @ â‚¦24,000", renews: "Apr 30, 2027", status: "Active", adapter: "DomainRegistrarAdapter", usage: { dns: 8, renew: 100 } }
];

export const domains = [
  { id: "DOM-001", domain: "example.com", client: "Brand De", registrar: "DomainRegistrarAdapter", price: "â‚¦24,000", renewal: "Apr 30, 2027", expiry: "Apr 30, 2027", autoRenew: "On", status: "Active" },
  { id: "DOM-002", domain: "octalve.cloud", client: "Octalve", registrar: "CloudflareAdapter", price: "Internal", renewal: "Managed", expiry: "Managed", autoRenew: "On", status: "Active" }
];

export const invoices = [
  { id: "INV-2026-0001", client: "Brand De", total: "â‚¦3,500", paid: "â‚¦3,500", due: "â‚¦0", date: "Apr 30, 2026", dueDate: "May 7, 2026", status: "Paid" },
  { id: "INV-2026-0002", client: "Brand De", total: "â‚¦24,000", paid: "â‚¦24,000", due: "â‚¦0", date: "Apr 30, 2026", dueDate: "May 7, 2026", status: "Paid" },
  { id: "INV-2026-0003", client: "Octalve Demo Client", total: "â‚¦15,000", paid: "â‚¦0", due: "â‚¦15,000", date: "May 1, 2026", dueDate: "May 8, 2026", status: "Unpaid" }
];

export const transactions = [
  { id: "TXN-001", client: "Brand De", type: "Paystack", amount: "â‚¦3,500", credited: "â‚¦0", applied: "â‚¦3,500", reference: "PSK-MOLMITRS", date: "Apr 30, 2026", status: "Approved" },
  { id: "TXN-002", client: "Brand De", type: "Bank Transfer", amount: "â‚¦24,000", credited: "â‚¦0", applied: "â‚¦24,000", reference: "BANK-MOLMITHV", date: "Apr 30, 2026", status: "Approved" }
];

export const orders = [
  { id: "OCT-MOLNWONA", customer: "Brand De", product: "Business Web Hosting", total: "â‚¦3,500", status: "Provisioned", date: "Apr 30, 2026" },
  { id: "OCT-MOLMITHV", customer: "Brand De", product: "VPS-1", total: "â‚¦24,000", status: "Pending Provisioning", date: "Apr 30, 2026" }
];

export const tickets = [
  { id: "TKT-MOLNZ6T5", customer: "Brand De", subject: "I want you to connect my DNS", department: "Support", priority: "High", status: "Waiting Customer", lastReply: "Apr 30, 15:54" },
  { id: "TKT-MIGRATE", customer: "Octalve Demo Client", subject: "Please migrate my WordPress website", department: "Migration", priority: "Medium", status: "Open", lastReply: "May 1, 08:20" }
];

export const kbArticles = [
  { title: "Getting Started with Octalve Cloud", category: "Getting Started", excerpt: "Learn how to set up your account and order your first hosting plan.", views: 46, likes: 18 },
  { title: "How to Point Your Domain to Our Servers", category: "Domain", excerpt: "Step-by-step guide to updating DNS nameservers.", views: 35, likes: 22 },
  { title: "How to Pay Your Invoice", category: "Billing", excerpt: "Payment options including card, bank transfer, wallet and manual confirmation.", views: 28, likes: 15 },
  { title: "How to Request Website Migration", category: "Migration", excerpt: "Submit source hosting details and track migration progress.", views: 17, likes: 9 },
  { title: "How Hosting Usage Works", category: "Hosting", excerpt: "Understand disk, bandwidth, email and database usage.", views: 22, likes: 11 },
  { title: "Managing VPS Power Actions", category: "VPS", excerpt: "Start, stop, reboot and monitor your VPS service.", views: 12, likes: 6 }
];

export const auditLogs = [
  { time: "Apr 30, 15:54:10", actor: "hellobrandde@gmail.com", role: "Customer", action: "create_ticket", entity: "SupportTicket", details: "Ticket TKT-MOLNZ6T5 created", ip: "-" },
  { time: "Apr 30, 15:52:14", actor: "hellobrandde@gmail.com", role: "Customer", action: "place_order", entity: "Order", details: "Order OCT-MOLNWONA placed â€” â‚¦3,500", ip: "-" },
  { time: "Apr 30, 15:37:04", actor: "hellobrandde@gmail.com", role: "Customer", action: "payment_submitted", entity: "Invoice", details: "Invoice INV-2026-0001 paid via Paystack", ip: "-" },
  { time: "Apr 30, 15:13:28", actor: "system", role: "System", action: "provisioning_queued", entity: "Service", details: "DirectAdmin provisioning task created", ip: "127.0.0.1" }
];

export const settingsGroups = [
  "General", "Security", "Social Login", "Tax", "Mail", "Tickets", "Cron Jobs", "Credits", "Theme", "Invoices", "Other"
];

export const apiPermissions = [
  "Create Users", "Update Users", "View Users", "Delete Users", "Impersonate Users",
  "Create Invoices", "Update Invoices", "View Invoices", "Delete Invoices", "Create Invoice Items", "Update Invoice Items", "View Invoice Items", "Delete Invoice Items",
  "Create Tickets", "Update Tickets", "View Tickets", "Delete Tickets", "Create Ticket Messages", "View Ticket Messages", "Delete Ticket Messages",
  "Create Orders", "Update Orders", "View Orders", "Delete Orders", "Create Services", "Update Services", "View Services", "Delete Services",
  "Create Coupons", "Update Coupons", "View Coupons", "Delete Coupons", "Create Credits", "Update Credits", "View Credits", "Delete Credits",
  "View Products", "View Categories", "View Custom Properties", "View Roles"
];
