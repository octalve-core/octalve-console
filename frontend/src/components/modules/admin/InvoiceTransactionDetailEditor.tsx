"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Globe2,
  Mail,
  Printer,
  Receipt,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  customers,
  invoices,
  orders,
  services,
  transactions,
} from "@/lib/platform-data";
import { PremiumStatusPill } from "@/components/modules/admin/AdminPremiumTable";

type EditorMode = "new" | "edit";

type InvoiceRecord = {
  id: string;
  client: string;
  total: string;
  paid: string;
  due: string;
  date: string;
  dueDate: string;
  status: string;
};

type TransactionRecord = {
  id: string;
  client: string;
  type: string;
  amount: string;
  credited: string;
  applied: string;
  reference: string;
  date: string;
  status: string;
};

const invoiceTabs = ["Overview", "Line Items", "Payment", "Delivery", "Audit"] as const;
const transactionTabs = ["Overview", "Verification", "Allocation", "Refunds", "Audit"] as const;

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
  icon: LucideIcon;
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

function InvoicePreview({
  invoice,
}: {
  invoice: InvoiceRecord;
}) {
  return (
    <div className="invoice-preview-premium">
      <div className="invoice-preview-head">
        <div>
          <span>Octalve Cloud</span>
          <strong>Invoice</strong>
        </div>
        <div>
          <span>Invoice No.</span>
          <strong>{invoice.id}</strong>
        </div>
      </div>

      <div className="invoice-preview-client">
        <div>
          <span>Billed To</span>
          <strong>{invoice.client}</strong>
          <p>Customer billing profile and tax details will come from backend.</p>
        </div>
        <div>
          <span>Status</span>
          <PremiumStatusPill status={invoice.status} />
        </div>
      </div>

      <div className="invoice-preview-lines">
        <SimpleRow label="Primary service" value={invoice.total} />
        <SimpleRow label="Tax" value="₦0" />
        <SimpleRow label="Discount" value="₦0" />
      </div>

      <div className="invoice-preview-total">
        <span>Amount Due</span>
        <strong>{invoice.due}</strong>
      </div>
    </div>
  );
}

export function InvoiceDetailEditor({
  mode,
  invoice,
}: {
  mode: EditorMode;
  invoice?: Partial<InvoiceRecord>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof invoiceTabs)[number]>("Overview");

  const value: InvoiceRecord = {
    id: invoice?.id ?? "INV-NEW",
    client: invoice?.client ?? "Select Customer",
    total: invoice?.total ?? "₦0",
    paid: invoice?.paid ?? "₦0",
    due: invoice?.due ?? "₦0",
    date: invoice?.date ?? "Today",
    dueDate: invoice?.dueDate ?? "Select due date",
    status: invoice?.status ?? "Unpaid",
  };

  const clientOptions = customers.map((customer) => customer.name);
  const relatedOrder = orders.find((order) => order.customer === value.client);
  const relatedService = services.find((service) => service.customer === value.client);
  const relatedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.client === value.client),
    [value.client]
  );

  const isPaid = value.status === "Paid";

  return (
    <div className="admin-detail-layout">
      <div className="admin-detail-main">
        <Card padded>
          <div className="admin-detail-hero">
            <div className="admin-detail-hero-left">
              <span className="admin-detail-avatar invoice">
                <Receipt size={26} />
              </span>
              <div>
                <p className="eyebrow">Billing Invoice</p>
                <h1>{mode === "new" ? "Create Invoice" : value.id}</h1>
                <p>
                  Manage invoice items, payment status, due dates, delivery, manual approval and
                  payment gateway allocation from one billing workspace.
                </p>
              </div>
            </div>

            <div className="admin-detail-actions">
              <Button href="/admin/billing/invoices" variant="secondary">Back</Button>
              <Button type="button" variant="secondary">
                <Printer size={16} /> Print
              </Button>
              <Button type="button">{mode === "new" ? "Create Invoice" : "Save Invoice"}</Button>
            </div>
          </div>

          <div className="admin-detail-meta">
            <PremiumStatusPill status={value.status} />
            <span>{value.client}</span>
            <span>Total: {value.total}</span>
            <span>Due: {value.due}</span>
          </div>
        </Card>

        <div className="admin-detail-tabs">
          {invoiceTabs.map((tab) => (
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
          <div className="invoice-detail-grid">
            <Card padded>
              <div className="section-heading">
                <div>
                  <h2>Invoice Information</h2>
                  <p>
                    Backend should be the source of truth for totals, tax, discount, wallet credit
                    and payment status.
                  </p>
                </div>
              </div>

              <div className="admin-detail-form-grid">
                <Field label="Invoice ID" value={value.id} />
                <SelectField label="Customer" value={value.client} options={["Select Customer", ...clientOptions]} />
                <Field label="Invoice Total" value={value.total} />
                <Field label="Amount Paid" value={value.paid} />
                <Field label="Amount Due" value={value.due} />
                <SelectField label="Status" value={value.status} options={["Draft", "Unpaid", "Partially Paid", "Paid", "Overdue", "Void", "Cancelled", "Refunded"]} />
                <Field label="Issue Date" value={value.date} />
                <Field label="Due Date" value={value.dueDate} />
                <TextAreaField
                  label="Admin Notes"
                  value="Internal billing note. This should not appear on the customer invoice unless explicitly enabled."
                />
              </div>

              <div className="admin-detail-stat-grid invoice-stat-grid">
                <StatTile icon={Receipt} label="Total" value={value.total} helper="Invoice total amount." />
                <StatTile icon={Wallet} label="Paid" value={value.paid} helper="Amount already settled." />
                <StatTile icon={Clock3} label="Due Date" value={value.dueDate} helper="Payment deadline." />
                <StatTile icon={CreditCard} label="Payment" value={value.status} helper="Current payment state." />
              </div>
            </Card>

            <Card padded>
              <InvoicePreview invoice={value} />
            </Card>
          </div>
        ) : null}

        {activeTab === "Line Items" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Invoice Line Items</h2>
                <p>
                  Line items should be generated from order items, service renewals, domain renewals
                  or manual admin entries.
                </p>
              </div>
              <Button type="button" variant="secondary">+ Add Item</Button>
            </div>

            <div className="invoice-line-table">
              <div className="invoice-line-row head">
                <span>Description</span>
                <span>Type</span>
                <span>Amount</span>
              </div>

              <div className="invoice-line-row">
                <span>{relatedOrder?.product ?? "Selected product or service"}</span>
                <span>Service</span>
                <strong>{value.total}</strong>
              </div>

              <div className="invoice-line-row">
                <span>Tax</span>
                <span>Tax rule</span>
                <strong>₦0</strong>
              </div>

              <div className="invoice-line-row">
                <span>Discount / Coupon</span>
                <span>Adjustment</span>
                <strong>₦0</strong>
              </div>
            </div>

            <div className="admin-detail-code">
              Backend should expose: GET /api/v1/admin/invoices/{value.id}/items/{"\n"}
              Backend should validate invoice item totals before payment.
            </div>
          </Card>
        ) : null}

        {activeTab === "Payment" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Payment Status</h2>
                <p>
                  Payment must be verified by the payment gateway webhook or manually approved by
                  an authorized admin.
                </p>
              </div>
            </div>

            <div className="admin-detail-split">
              <div className="admin-detail-panel">
                <h3>Payment Allocation</h3>
                <SimpleRow label="Invoice Total" value={value.total} />
                <SimpleRow label="Amount Paid" value={value.paid} />
                <SimpleRow label="Amount Due" value={value.due} />
                <SimpleRow label="Payment State" value={value.status} />
              </div>

              <div className="admin-detail-panel">
                <h3>Related Transactions</h3>
                <div className="admin-detail-list compact">
                  {relatedTransactions.length ? (
                    relatedTransactions.map((transaction) => (
                      <SimpleRow
                        key={transaction.id}
                        label={`${transaction.id} · ${transaction.type}`}
                        value={`${transaction.amount} · ${transaction.status}`}
                        href={`/admin/billing/transactions/${transaction.id}`}
                      />
                    ))
                  ) : (
                    <SimpleRow label="No transaction yet" value="Awaiting payment" />
                  )}
                </div>
              </div>
            </div>

            <div className="invoice-action-grid">
              <button type="button">
                <CheckCircle2 size={17} />
                Mark as Paid
              </button>
              <button type="button">
                <Banknote size={17} />
                Record Manual Payment
              </button>
              <button type="button">
                <XCircle size={17} />
                Void Invoice
              </button>
              <button type="button">
                <RotateCcw size={17} />
                Refund Direction
              </button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Delivery" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Invoice Delivery</h2>
                <p>
                  Send, resend, download and print invoice. Email delivery should use official
                  notification templates.
                </p>
              </div>
            </div>

            <div className="admin-detail-readiness-grid">
              <StatTile icon={Mail} label="Email Template" value="Invoice Created" helper="Connect to notification templates." />
              <StatTile icon={Download} label="PDF Export" value="Ready UI" helper="Backend can generate official PDF later." />
              <StatTile icon={Printer} label="Print View" value="Available" helper="Browser print now, PDF later." />
              <StatTile icon={Globe2} label="Client Portal" value="Visible" helper="Client should see invoice in portal." />
            </div>

            <div className="admin-detail-code">
              POST /api/v1/admin/invoices/{value.id}/send/{"\n"}
              GET  /api/v1/admin/invoices/{value.id}/pdf/{"\n"}
              GET  /api/v1/client/invoices/{value.id}/
            </div>
          </Card>
        ) : null}

        {activeTab === "Audit" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Invoice Audit Trail</h2>
                <p>Every invoice creation, edit, payment allocation, void and refund should be logged.</p>
              </div>
            </div>

            <div className="admin-detail-timeline">
              <TimelineItem tone="blue" title="Invoice created" text="Invoice generated from order or manual admin action." />
              <TimelineItem tone={isPaid ? "green" : "orange"} title="Payment checked" text={isPaid ? "Invoice has been paid." : "Invoice is still awaiting payment."} />
              <TimelineItem tone="blue" title="Delivery prepared" text="Invoice can be sent to customer through email template." />
              <TimelineItem tone="blue" title="Provisioning dependency" text="If invoice is tied to order, provisioning starts only after paid status." />
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="admin-detail-side">
        <Card padded>
          <div className="admin-detail-side-title">
            <Receipt size={18} />
            <strong>Invoice Summary</strong>
          </div>
          <div className="admin-detail-contact">
            <span>{value.client}</span>
            <span>Total: {value.total}</span>
            <span>Due: {value.due}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <PackageCheckIcon />
            <strong>Linked Records</strong>
          </div>
          <div className="admin-detail-contact">
            <span>Order: {relatedOrder?.id ?? "None"}</span>
            <span>Service: {relatedService?.id ?? "None"}</span>
            <span>Transactions: {relatedTransactions.length}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <ShieldCheck size={18} />
            <strong>Backend Requirements</strong>
          </div>
          <div className="admin-detail-code">
            GET /api/v1/admin/invoices/{value.id}/{"\n"}
            PATCH /api/v1/admin/invoices/{value.id}/{"\n"}
            POST /api/v1/admin/invoices/{value.id}/pay/{"\n"}
            POST /api/v1/admin/invoices/{value.id}/void/
          </div>
        </Card>
      </aside>
    </div>
  );
}

function PackageCheckIcon() {
  return <BadgeCheck size={18} />;
}

export function TransactionDetailEditor({
  mode,
  transaction,
}: {
  mode: EditorMode;
  transaction?: Partial<TransactionRecord>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof transactionTabs)[number]>("Overview");

  const value: TransactionRecord = {
    id: transaction?.id ?? "TXN-NEW",
    client: transaction?.client ?? "Select Customer",
    type: transaction?.type ?? "Paystack",
    amount: transaction?.amount ?? "₦0",
    credited: transaction?.credited ?? "₦0",
    applied: transaction?.applied ?? "₦0",
    reference: transaction?.reference ?? "REFERENCE-PENDING",
    date: transaction?.date ?? "Today",
    status: transaction?.status ?? "Pending",
  };

  const clientOptions = customers.map((customer) => customer.name);
  const relatedInvoice = invoices.find((invoice) => invoice.client === value.client);
  const relatedOrder = orders.find((order) => order.customer === value.client);

  const isApproved = value.status === "Approved" || value.status === "Paid" || value.status === "Successful";

  return (
    <div className="admin-detail-layout">
      <div className="admin-detail-main">
        <Card padded>
          <div className="admin-detail-hero">
            <div className="admin-detail-hero-left">
              <span className="admin-detail-avatar transaction">
                <CreditCard size={26} />
              </span>
              <div>
                <p className="eyebrow">Payment Transaction</p>
                <h1>{mode === "new" ? "Record Transaction" : value.id}</h1>
                <p>
                  Verify payment source, gateway reference, invoice allocation, wallet credit and
                  refund state from one payment control screen.
                </p>
              </div>
            </div>

            <div className="admin-detail-actions">
              <Button href="/admin/billing/transactions" variant="secondary">Back</Button>
              <Button type="button" variant="secondary">
                <RefreshCcw size={16} /> Recheck
              </Button>
              <Button type="button">{mode === "new" ? "Create Transaction" : "Save Transaction"}</Button>
            </div>
          </div>

          <div className="admin-detail-meta">
            <PremiumStatusPill status={value.status} />
            <span>{value.client}</span>
            <span>{value.type}</span>
            <span>{value.amount}</span>
          </div>
        </Card>

        <div className="admin-detail-tabs">
          {transactionTabs.map((tab) => (
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
                <h2>Transaction Information</h2>
                <p>
                  Transaction records should be created by verified gateway callback, webhook or
                  authorized manual admin action.
                </p>
              </div>
            </div>

            <div className="admin-detail-form-grid">
              <Field label="Transaction ID" value={value.id} />
              <SelectField label="Customer" value={value.client} options={["Select Customer", ...clientOptions]} />
              <SelectField label="Payment Type" value={value.type} options={["Paystack", "Flutterwave", "Bank Transfer", "Wallet", "Manual Payment", "Crypto"]} />
              <Field label="Amount" value={value.amount} />
              <Field label="Credited to Wallet" value={value.credited} />
              <Field label="Applied to Invoice" value={value.applied} />
              <Field label="Reference" value={value.reference} />
              <SelectField label="Status" value={value.status} options={["Pending", "Approved", "Successful", "Failed", "Cancelled", "Refunded", "Manual Review"]} />
              <Field label="Transaction Date" value={value.date} />
              <TextAreaField
                label="Admin Notes"
                value="Use this for manual payment proof, bank transfer note, gateway issue or refund reason."
              />
            </div>

            <div className="admin-detail-stat-grid invoice-stat-grid">
              <StatTile icon={CreditCard} label="Gateway" value={value.type} helper="Payment method used." />
              <StatTile icon={Banknote} label="Amount" value={value.amount} helper="Total received or recorded." />
              <StatTile icon={Receipt} label="Invoice" value={relatedInvoice?.id ?? "Not allocated"} helper="Invoice affected." />
              <StatTile icon={ShieldCheck} label="Verification" value={isApproved ? "Verified" : "Pending"} helper="Gateway/manual verification." />
            </div>
          </Card>
        ) : null}

        {activeTab === "Verification" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Payment Verification</h2>
                <p>
                  Backend must verify Paystack/Flutterwave references server-side before approving
                  any transaction.
                </p>
              </div>
            </div>

            <div className="admin-detail-split">
              <div className="admin-detail-panel">
                <h3>Gateway Reference</h3>
                <SimpleRow label="Gateway" value={value.type} />
                <SimpleRow label="Reference" value={value.reference} />
                <SimpleRow label="Status" value={value.status} />
              </div>

              <div className="admin-detail-panel">
                <h3>Backend Checks</h3>
                <SimpleRow label="Amount matched" value={isApproved ? "Yes" : "Pending"} />
                <SimpleRow label="Currency matched" value="NGN" />
                <SimpleRow label="Duplicate check" value="Required" />
              </div>
            </div>

            <div className="transaction-verification-box">
              <AlertTriangle size={18} />
              <p>
                Never trust frontend payment success alone. Backend must verify gateway reference
                and webhook signature before marking invoice as paid.
              </p>
            </div>

            <div className="admin-detail-code">
              POST /api/v1/payments/paystack/verify/{"\n"}
              POST /api/v1/payments/flutterwave/verify/{"\n"}
              POST /api/v1/webhooks/paystack/{"\n"}
              POST /api/v1/webhooks/flutterwave/
            </div>
          </Card>
        ) : null}

        {activeTab === "Allocation" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Invoice / Wallet Allocation</h2>
                <p>
                  A transaction can be applied to invoice, wallet balance, or partially split
                  depending on backend billing rules.
                </p>
              </div>
            </div>

            <div className="admin-detail-split">
              <div className="admin-detail-panel">
                <h3>Invoice Allocation</h3>
                <SimpleRow
                  label="Invoice"
                  value={relatedInvoice?.id ?? "Not selected"}
                  href={relatedInvoice ? `/admin/billing/invoices/${relatedInvoice.id}` : undefined}
                />
                <SimpleRow label="Applied Amount" value={value.applied} />
                <SimpleRow label="Invoice Status" value={relatedInvoice?.status ?? "Unpaid"} />
              </div>

              <div className="admin-detail-panel">
                <h3>Wallet Allocation</h3>
                <SimpleRow label="Wallet Credit" value={value.credited} />
                <SimpleRow label="Auto-use credit" value="Future backend setting" />
                <SimpleRow label="Ledger entry" value="Required" />
              </div>
            </div>

            <div className="invoice-action-grid">
              <button type="button">
                <Receipt size={17} />
                Apply to Invoice
              </button>
              <button type="button">
                <Wallet size={17} />
                Credit Wallet
              </button>
              <button type="button">
                <CheckCircle2 size={17} />
                Approve Manual Payment
              </button>
              <button type="button">
                <XCircle size={17} />
                Reject Payment
              </button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Refunds" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Refund Direction</h2>
                <p>
                  Refund handling should be controlled by backend permissions, gateway rules and
                  audit logs.
                </p>
              </div>
            </div>

            <div className="admin-detail-readiness-grid">
              <StatTile icon={RotateCcw} label="Refund State" value="Not refunded" helper="Future refund workflow." />
              <StatTile icon={Receipt} label="Invoice Impact" value={relatedInvoice?.id ?? "None"} helper="Invoice may become refunded/partially refunded." />
              <StatTile icon={Wallet} label="Wallet Impact" value="Optional" helper="Refund can be wallet credit if policy allows." />
              <StatTile icon={ShieldCheck} label="Permission" value="Admin only" helper="Refund must be restricted." />
            </div>

            <div className="admin-detail-code">
              POST /api/v1/admin/transactions/{value.id}/refund/{"\n"}
              POST /api/v1/admin/wallet/credit/{"\n"}
              Every refund must create audit log.
            </div>
          </Card>
        ) : null}

        {activeTab === "Audit" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Transaction Audit Trail</h2>
                <p>Every payment verification, allocation, refund and manual update should be logged.</p>
              </div>
            </div>

            <div className="admin-detail-timeline">
              <TimelineItem tone="blue" title="Transaction created" text="Transaction record was created from gateway, webhook or manual admin action." />
              <TimelineItem tone={isApproved ? "green" : "orange"} title="Verification state" text={isApproved ? "Payment has been approved." : "Payment still requires verification."} />
              <TimelineItem tone="blue" title="Invoice allocation checked" text={relatedInvoice ? `Linked to ${relatedInvoice.id}.` : "No invoice allocation yet."} />
              <TimelineItem tone="blue" title="Order dependency" text={relatedOrder ? `Related order ${relatedOrder.id}.` : "No related order found."} />
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="admin-detail-side">
        <Card padded>
          <div className="admin-detail-side-title">
            <CreditCard size={18} />
            <strong>Payment Summary</strong>
          </div>
          <div className="admin-detail-contact">
            <span>{value.client}</span>
            <span>{value.type}</span>
            <span>{value.amount}</span>
            <span>{value.reference}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <Receipt size={18} />
            <strong>Linked Records</strong>
          </div>
          <div className="admin-detail-contact">
            <span>Invoice: {relatedInvoice?.id ?? "None"}</span>
            <span>Order: {relatedOrder?.id ?? "None"}</span>
            <span>Applied: {value.applied}</span>
          </div>
        </Card>

        <Card padded>
          <div className="admin-detail-side-title">
            <ShieldCheck size={18} />
            <strong>Backend Requirements</strong>
          </div>
          <div className="admin-detail-code">
            GET /api/v1/admin/transactions/{value.id}/{"\n"}
            PATCH /api/v1/admin/transactions/{value.id}/{"\n"}
            POST /api/v1/admin/transactions/{value.id}/approve/{"\n"}
            POST /api/v1/admin/transactions/{value.id}/refund/
          </div>
        </Card>
      </aside>
    </div>
  );
}
