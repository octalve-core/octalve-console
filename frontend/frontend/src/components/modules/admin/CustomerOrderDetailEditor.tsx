"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  FileText,
  Globe2,
  LifeBuoy,
  ListChecks,
  Mail,
  PackageCheck,
  Phone,
  PlugZap,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  customers,
  invoices,
  orders,
  services,
  tickets,
  transactions,
} from "@/lib/platform-data";
import { PremiumStatusPill } from "@/components/modules/admin/AdminPremiumTable";

type EditorMode = "new" | "edit";

type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  balance?: string;
  services?: number;
  invoices?: number;
};

type OrderRecord = {
  id: string;
  customer: string;
  product: string;
  total: string;
  status: string;
  date: string;
};

const customerTabs = ["Overview", "Services", "Billing", "Tickets", "Security"] as const;
const orderTabs = ["Overview", "Items", "Payment", "Provisioning", "Audit"] as const;

function Field({
  label,
  value,
  placeholder,
  type = "text",
  helper,
}: {
  label: string;
  value?: string | number;
  placeholder?: string;
  type?: string;
  helper?: string;
}) {
  return (
    <label className="admin-detail-field">
      <span>{label}</span>
      <input type={type} defaultValue={value} placeholder={placeholder} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  helper,
}: {
  label: string;
  value?: string;
  options: string[];
  helper?: string;
}) {
  return (
    <label className="admin-detail-field">
      <span>{label}</span>
      <select defaultValue={value}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  helper,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  helper?: string;
}) {
  return (
    <label className="admin-detail-field admin-detail-field-full">
      <span>{label}</span>
      <textarea defaultValue={value} placeholder={placeholder} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof UserRound;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="admin-detail-stat">
      <span>
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{helper}</p>
      </div>
    </div>
  );
}

function TimelineItem({
  tone = "blue",
  title,
  text,
}: {
  tone?: "blue" | "green" | "orange" | "red";
  title: string;
  text: string;
}) {
  return (
    <div className="admin-detail-timeline-item">
      <span className={`admin-detail-dot ${tone}`} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function SimpleRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (href) {
    return (
      <a className="admin-detail-row" href={href}>
        {content}
      </a>
    );
  }

  return <div className="admin-detail-row">{content}</div>;
}

export function CustomerDetailEditor({
  mode,
  customer,
}: {
  mode: EditorMode;
  customer?: Partial<CustomerRecord>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof customerTabs)[number]>("Overview");

  const value: CustomerRecord = {
    id: customer?.id ?? "CUST-NEW",
    name: customer?.name ?? "New Customer",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    status: customer?.status ?? "Active",
    balance: customer?.balance ?? "₦0",
    services: customer?.services ?? 0,
    invoices: customer?.invoices ?? 0,
  };

  const customerServices = useMemo(
    () => services.filter((service) => service.customer === value.name),
    [value.name]
  );

  const customerInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.client === value.name),
    [value.name]
  );

  const customerTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.client === value.name),
    [value.name]
  );

  const customerTickets = useMemo(
    () => tickets.filter((ticket) => ticket.customer === value.name),
    [value.name]
  );

  return (
    <div className="admin-detail-layout">
      <div className="admin-detail-main">
        <Card padded>
          <div className="admin-detail-hero">
            <div className="admin-detail-hero-left">
              <span className="admin-detail-avatar">
                <UserRound size={26} />
              </span>
              <div>
                <p className="eyebrow">Customer Account</p>
                <h1>{mode === "new" ? "Create Customer" : value.name}</h1>
                <p>
                  Manage customer identity, billing, services, support activity, wallet status and
                  security posture from one admin workspace.
                </p>
              </div>
            </div>

            <div className="admin-detail-actions">
              <Button href="/admin/customers" variant="secondary">Back</Button>
              <Button type="button">{mode === "new" ? "Create Customer" : "Save Changes"}</Button>
            </div>
          </div>

          <div className="admin-detail-meta">
            <PremiumStatusPill status={value.status} />
            <span>{value.id}</span>
            <span>{value.email || "No email yet"}</span>
            <span>{value.phone || "No phone yet"}</span>
          </div>
        </Card>

        <div className="admin-detail-tabs">
          {customerTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "admin-detail-tab active" : "admin-detail-tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Customer Profile</h2>
                <p>
                  Backend should connect this to the user, client profile, roles, wallet and billing
                  records.
                </p>
              </div>
            </div>

            <div className="admin-detail-form-grid">
              <Field label="Customer ID" value={value.id} />
              <Field label="Full Name / Company" value={value.name} />
              <Field label="Email Address" value={value.email} type="email" />
              <Field label="Phone Number" value={value.phone} />
              <SelectField label="Status" value={value.status} options={["Active", "Inactive", "Suspended", "Archived"]} />
              <SelectField label="Role" value="client" options={["client", "staff", "admin"]} helper="Backend RBAC must enforce this." />
              <TextAreaField
                label="Admin Notes"
                value="Keep internal notes about client risk, special billing agreement, onboarding state or support concerns."
              />
            </div>

            <div className="admin-detail-stat-grid">
              <StatTile icon={PackageCheck} label="Services" value={customerServices.length} helper="Active or pending services." />
              <StatTile icon={Receipt} label="Invoices" value={customerInvoices.length} helper="Linked customer invoices." />
              <StatTile icon={Wallet} label="Wallet Balance" value={value.balance ?? "₦0"} helper="Wallet credit available." />
              <StatTile icon={LifeBuoy} label="Tickets" value={customerTickets.length} helper="Support requests opened." />
            </div>
          </Card>
        ) : null}

        {activeTab === "Services" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Customer Services</h2>
                <p>Hosting, VPS, domains, SSL, email and backup services linked to this customer.</p>
              </div>
              <Button href="/admin/billing/services/new" variant="secondary">+ Add Service</Button>
            </div>

            <div className="admin-detail-list">
              {customerServices.length ? (
                customerServices.map((service) => (
                  <a className="admin-detail-service-card" href={`/admin/billing/services/${service.id}`} key={service.id}>
                    <span><PackageCheck size={18} /></span>
                    <div>
                      <strong>{service.package}</strong>
                      <p>{service.label} · {service.product} · renews {service.renews}</p>
                    </div>
                    <PremiumStatusPill status={service.status} />
                  </a>
                ))
              ) : (
                <div className="empty-state">No services linked yet.</div>
              )}
            </div>
          </Card>
        ) : null}

        {activeTab === "Billing" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Billing Overview</h2>
                <p>Invoices, transactions and wallet movements connected to this customer.</p>
              </div>
              <Button href="/admin/billing/invoices/new" variant="secondary">+ New Invoice</Button>
            </div>

            <div className="admin-detail-split">
              <div>
                <h3 className="admin-detail-mini-title">Invoices</h3>
                <div className="admin-detail-list compact">
                  {customerInvoices.map((invoice) => (
                    <SimpleRow
                      key={invoice.id}
                      label={`${invoice.id} · ${invoice.date}`}
                      value={`${invoice.total} · ${invoice.status}`}
                      href={`/admin/billing/invoices/${invoice.id}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="admin-detail-mini-title">Transactions</h3>
                <div className="admin-detail-list compact">
                  {customerTransactions.map((transaction) => (
                    <SimpleRow
                      key={transaction.id}
                      label={`${transaction.id} · ${transaction.type}`}
                      value={`${transaction.amount} · ${transaction.status}`}
                      href={`/admin/billing/transactions/${transaction.id}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {activeTab === "Tickets" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Support Activity</h2>
                <p>Customer support requests, priorities and recent communication.</p>
              </div>
              <Button href="/admin/support/new" variant="secondary">+ Open Ticket</Button>
            </div>

            <div className="admin-detail-list">
              {customerTickets.length ? (
                customerTickets.map((ticket) => (
                  <a className="admin-detail-service-card" href={`/admin/support/${ticket.id}`} key={ticket.id}>
                    <span><LifeBuoy size={18} /></span>
                    <div>
                      <strong>{ticket.subject}</strong>
                      <p>{ticket.department} · {ticket.priority} priority · last reply {ticket.lastReply}</p>
                    </div>
                    <PremiumStatusPill status={ticket.status} />
                  </a>
                ))
              ) : (
                <div className="empty-state">No tickets yet.</div>
              )}
            </div>
          </Card>
        ) : null}

        {activeTab === "Security" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Security & Access</h2>
                <p>Use this space for role, login, fraud, impersonation and account safety controls.</p>
              </div>
            </div>

            <div className="admin-detail-readiness-grid">
              <StatTile icon={ShieldCheck} label="RBAC" value="Client" helper="Backend must enforce client-only access." />
              <StatTile icon={Mail} label="Email" value="Verified soon" helper="Connect to email verification flow." />
              <StatTile icon={AlertTriangle} label="Risk Flag" value="None" helper="Future fraud/risk controls." />
              <StatTile icon={UserRound} label="Impersonation" value="Future" helper="Admin impersonation must be audited." />
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="admin-detail-side">
        <Card padded>
          <div className="admin-detail-side-title">
            <Wallet size={18} />
            <strong>Wallet</strong>
          </div>
          <p>{value.balance ?? "₦0"} available balance.</p>
          <div className="admin-detail-side-actions">
            <Button type="button" variant="secondary">Credit</Button>
            <Button type="button" variant="secondary">Debit</Button>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <Phone size={18} />
            <strong>Contact</strong>
          </div>
          <div className="admin-detail-contact">
            <span>{value.email || "No email"}</span>
            <span>{value.phone || "No phone"}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <ShieldCheck size={18} />
            <strong>Backend Requirements</strong>
          </div>
          <div className="admin-detail-code">
            GET /api/v1/admin/customers/{value.id}/{"\n"}
            PATCH /api/v1/admin/customers/{value.id}/{"\n"}
            GET /api/v1/admin/customers/{value.id}/services/{"\n"}
            GET /api/v1/admin/customers/{value.id}/wallet/
          </div>
        </Card>
      </aside>
    </div>
  );
}

export function OrderDetailEditor({
  mode,
  order,
}: {
  mode: EditorMode;
  order?: Partial<OrderRecord>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof orderTabs)[number]>("Overview");

  const value: OrderRecord = {
    id: order?.id ?? "OCT-NEW",
    customer: order?.customer ?? "Select Customer",
    product: order?.product ?? "Select Product",
    total: order?.total ?? "₦0",
    status: order?.status ?? "Pending",
    date: order?.date ?? "Today",
  };

  const customerOptions = customers.map((customer) => customer.name);
  const relatedInvoice = invoices.find((invoice) => invoice.client === value.customer);
  const relatedService = services.find((service) => service.customer === value.customer);
  const relatedTransaction = transactions.find((transaction) => transaction.client === value.customer);

  return (
    <div className="admin-detail-layout">
      <div className="admin-detail-main">
        <Card padded>
          <div className="admin-detail-hero">
            <div className="admin-detail-hero-left">
              <span className="admin-detail-avatar order">
                <ShoppingCart size={26} />
              </span>
              <div>
                <p className="eyebrow">Customer Order</p>
                <h1>{mode === "new" ? "Create Order" : value.id}</h1>
                <p>
                  Review order items, billing status, payment confirmation and provisioning readiness
                  before service activation.
                </p>
              </div>
            </div>

            <div className="admin-detail-actions">
              <Button href="/admin/orders" variant="secondary">Back</Button>
              <Button type="button">{mode === "new" ? "Create Order" : "Save Order"}</Button>
            </div>
          </div>

          <div className="admin-detail-meta">
            <PremiumStatusPill status={value.status} />
            <span>{value.customer}</span>
            <span>{value.product}</span>
            <span>{value.total}</span>
          </div>
        </Card>

        <div className="admin-detail-tabs">
          {orderTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "admin-detail-tab active" : "admin-detail-tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Order Information</h2>
                <p>
                  Backend should validate order pricing, coupon, tax, selected plan and selected add-ons
                  before invoice creation.
                </p>
              </div>
            </div>

            <div className="admin-detail-form-grid">
              <Field label="Order ID" value={value.id} />
              <SelectField label="Customer" value={value.customer} options={["Select Customer", ...customerOptions]} />
              <Field label="Product / Service" value={value.product} />
              <Field label="Order Total" value={value.total} />
              <SelectField label="Status" value={value.status} options={["Draft", "Pending", "Pending Payment", "Paid", "Provisioned", "Cancelled", "Failed", "Needs Review"]} />
              <Field label="Order Date" value={value.date} />
              <TextAreaField
                label="Admin Notes"
                value="Use this for manual order context, special provisioning notes or customer-specific setup instructions."
              />
            </div>

            <div className="admin-detail-stat-grid">
              <StatTile icon={Receipt} label="Invoice" value={relatedInvoice?.id ?? "Not created"} helper="Invoice generated from order." />
              <StatTile icon={CreditCard} label="Payment" value={relatedTransaction?.status ?? "Pending"} helper="Gateway/manual payment state." />
              <StatTile icon={PlugZap} label="Provisioning" value={relatedService?.status ?? "Not queued"} helper="Service activation status." />
              <StatTile icon={BadgeCheck} label="Customer" value={value.customer} helper="Account attached to this order." />
            </div>
          </Card>
        ) : null}

        {activeTab === "Items" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Order Items</h2>
                <p>Products, plans, domains, add-ons and setup services included in this order.</p>
              </div>
              <Button type="button" variant="secondary">+ Add Item</Button>
            </div>

            <div className="admin-detail-list">
              <div className="admin-detail-service-card">
                <span><ListChecks size={18} /></span>
                <div>
                  <strong>{value.product}</strong>
                  <p>Main product selected by customer. Backend should connect exact plan, cycle and provider mapping.</p>
                </div>
                <strong>{value.total}</strong>
              </div>

              <div className="admin-detail-service-card">
                <span><Globe2 size={18} /></span>
                <div>
                  <strong>Domain / DNS option</strong>
                  <p>Use existing domain, register new domain or transfer domain should be stored on order metadata.</p>
                </div>
                <strong>Optional</strong>
              </div>

              <div className="admin-detail-service-card">
                <span><ShieldCheck size={18} /></span>
                <div>
                  <strong>Add-ons</strong>
                  <p>SSL, email, backup and migration upsells should be linked as order items.</p>
                </div>
                <strong>Optional</strong>
              </div>
            </div>
          </Card>
        ) : null}

        {activeTab === "Payment" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Payment & Invoice</h2>
                <p>Payment must be verified by backend webhook before order becomes ready for provisioning.</p>
              </div>
            </div>

            <div className="admin-detail-split">
              <div className="admin-detail-panel">
                <h3>Invoice</h3>
                <SimpleRow label="Invoice ID" value={relatedInvoice?.id ?? "Not created"} href={relatedInvoice ? `/admin/billing/invoices/${relatedInvoice.id}` : undefined} />
                <SimpleRow label="Total" value={relatedInvoice?.total ?? value.total} />
                <SimpleRow label="Status" value={relatedInvoice?.status ?? "Unpaid"} />
              </div>

              <div className="admin-detail-panel">
                <h3>Transaction</h3>
                <SimpleRow label="Reference" value={relatedTransaction?.reference ?? "Pending"} />
                <SimpleRow label="Gateway" value={relatedTransaction?.type ?? "Not selected"} />
                <SimpleRow label="Status" value={relatedTransaction?.status ?? "Pending"} />
              </div>
            </div>
          </Card>
        ) : null}

        {activeTab === "Provisioning" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Provisioning Readiness</h2>
                <p>Provisioning should only run through the queue after confirmed payment.</p>
              </div>
              <Button href="/admin/provisioning" variant="secondary">Open Queue</Button>
            </div>

            <div className="admin-detail-timeline">
              <TimelineItem tone="green" title="Order created" text="Order record exists with customer, items and total." />
              <TimelineItem tone={relatedInvoice?.status === "Paid" ? "green" : "orange"} title="Invoice payment" text="Payment must be confirmed by gateway webhook or admin manual approval." />
              <TimelineItem tone={relatedService ? "green" : "orange"} title="Service creation" text="Service should be created after paid invoice and order readiness." />
              <TimelineItem tone="blue" title="Welcome email" text="Correct service welcome email should be sent after successful provisioning." />
            </div>

            <div className="admin-detail-code">
              POST /api/v1/admin/orders/{value.id}/approve/{"\n"}
              POST /api/v1/admin/provisioning/queue/{"\n"}
              POST /api/v1/admin/provisioning/queue/:id/run/
            </div>
          </Card>
        ) : null}

        {activeTab === "Audit" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Order Audit Trail</h2>
                <p>Every payment, invoice, provisioning and admin change should be auditable.</p>
              </div>
            </div>

            <div className="admin-detail-timeline">
              <TimelineItem title="Order opened" text="Admin viewed order detail page." />
              <TimelineItem title="Payment status checked" text="Transaction and invoice status reviewed." />
              <TimelineItem title="Provisioning readiness checked" text="Order is waiting for backend queue confirmation." />
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="admin-detail-side">
        <Card padded>
          <div className="admin-detail-side-title">
            <Receipt size={18} />
            <strong>Order Summary</strong>
          </div>
          <div className="admin-detail-contact">
            <span>{value.customer}</span>
            <span>{value.product}</span>
            <span>{value.total}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <CreditCard size={18} />
            <strong>Payment Rule</strong>
          </div>
          <p>Backend must recalculate price and confirm payment before provisioning.</p>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <PlugZap size={18} />
            <strong>Backend Requirements</strong>
          </div>
          <div className="admin-detail-code">
            GET /api/v1/admin/orders/{value.id}/{"\n"}
            PATCH /api/v1/admin/orders/{value.id}/{"\n"}
            POST /api/v1/admin/orders/{value.id}/approve/{"\n"}
            POST /api/v1/admin/orders/{value.id}/cancel/
          </div>
        </Card>
      </aside>
    </div>
  );
}
