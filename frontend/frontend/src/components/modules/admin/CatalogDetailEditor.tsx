"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Globe2,
  Layers,
  ListChecks,
  Package,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { products, plans, adapters } from "@/lib/platform-data";
import { money } from "@/lib/utils";
import { PremiumStatusPill } from "@/components/modules/admin/AdminPremiumTable";

type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  adapter: string;
  status: string;
  description?: string;
};

type CatalogPlan = {
  id: string;
  name: string;
  product: string;
  currency: string;
  price: number;
  cycle: string;
  storage?: string;
  bandwidth?: string;
  websites?: string;
  emails?: string;
  databases?: string;
  ssl?: boolean;
  popular?: boolean;
  adapter: string;
  features: string[];
  cycles: { label: string; price: number }[];
};

type EditorMode = "new" | "edit";

const productTabs = ["Overview", "Provider Mapping", "Automation", "Visibility"] as const;
const planTabs = ["Overview", "Pricing", "Features", "Provider Mapping", "Automation"] as const;

function Field({
  label,
  value,
  placeholder,
  helper,
  type = "text",
}: {
  label: string;
  value?: string | number;
  placeholder?: string;
  helper?: string;
  type?: string;
}) {
  return (
    <label className="catalog-field">
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
    <label className="catalog-field">
      <span>{label}</span>
      <select defaultValue={value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
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
    <label className="catalog-field catalog-field-full">
      <span>{label}</span>
      <textarea defaultValue={value} placeholder={placeholder} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function ReadinessItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CheckCircle2;
  title: string;
  text: string;
}) {
  return (
    <div className="catalog-readiness-item">
      <span>
        <Icon size={17} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function ApiBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="catalog-api-box">
      <strong>{title}</strong>
      <pre>{lines.join("\n")}</pre>
    </div>
  );
}

export function ProductDetailEditor({
  mode,
  product,
}: {
  mode: EditorMode;
  product?: Partial<CatalogProduct>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof productTabs)[number]>("Overview");

  const value: CatalogProduct = {
    id: product?.id ?? "PRD-NEW",
    name: product?.name ?? "New Product",
    category: product?.category ?? "Hosting",
    adapter: product?.adapter ?? "DirectAdminAdapter",
    status: product?.status ?? "Active",
    description:
      product?.description ??
      "Define what this product represents, how it appears in checkout and which provider adapter will power automation.",
  };

  const relatedPlans = useMemo(
    () => plans.filter((plan) => plan.product === value.name),
    [value.name]
  );

  const adapterOptions = adapters.map((adapter) => adapter.name);
  const categoryOptions = ["Hosting", "Servers", "Domains", "Security", "Email", "Backups", "Migration", "Custom"];

  return (
    <div className="catalog-detail-grid">
      <div className="catalog-main-stack">
        <Card padded>
          <div className="catalog-hero-card">
            <div className="catalog-hero-top">
              <span className="catalog-hero-icon">
                <Package size={24} />
              </span>
              <div>
                <p className="eyebrow">Catalog Product</p>
                <h1>{mode === "new" ? "Create Product" : value.name}</h1>
                <p>
                  Products define the service line customers buy. Plans, pricing, checkout,
                  invoices and provider provisioning should all connect back to this record.
                </p>
              </div>
            </div>

            <div className="catalog-status-row">
              <PremiumStatusPill status={value.status} />
              <span>{value.id}</span>
              <span>{value.category}</span>
              <span>{value.adapter}</span>
            </div>
          </div>
        </Card>

        <div className="catalog-tabs">
          {productTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "catalog-tab active" : "catalog-tab"}
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
                <h2>Product Information</h2>
                <p>
                  This section should sync with the backend product table and become the root
                  source for public order pages, admin plans and checkout grouping.
                </p>
              </div>
              <Button href="/admin/products" variant="secondary">Back</Button>
            </div>

            <div className="catalog-form-grid">
              <Field label="Product ID" value={value.id} helper="Internal product code. Backend should keep this unique." />
              <Field label="Product Name" value={value.name} />
              <SelectField label="Category" value={value.category} options={categoryOptions} />
              <SelectField label="Status" value={value.status} options={["Active", "Inactive", "Planned", "Archived"]} />
              <SelectField label="Default Adapter" value={value.adapter} options={adapterOptions} helper="Admin-only. Do not expose adapter names to clients." />
              <SelectField label="Public Visibility" value="Visible in checkout" options={["Visible in checkout", "Hidden from checkout", "Admin only"]} />
              <TextAreaField label="Description" value={value.description} />
            </div>

            <div className="page-actions">
              <Button href="/admin/products" variant="secondary">Cancel</Button>
              <Button type="button">{mode === "new" ? "Create Product" : "Save Product"}</Button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Provider Mapping" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Provider Mapping</h2>
                <p>
                  Product mapping decides the adapter family. Specific provider package mapping
                  happens mainly at plan level.
                </p>
              </div>
            </div>

            <div className="catalog-form-grid">
              <SelectField label="Adapter Type" value={value.adapter} options={adapterOptions} />
              <Field label="Provider Group" value={`${value.category.toLowerCase()}-default`} />
              <Field label="Provisioning Queue" value="Queue after paid invoice" />
              <Field label="Welcome Template" value={`${value.name} Welcome Email`} />
              <TextAreaField
                label="Provider Notes"
                value="Backend should store provider credentials securely and expose only non-sensitive provider health/status to admin."
              />
            </div>
          </Card>
        ) : null}

        {activeTab === "Automation" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Automation Readiness</h2>
                <p>
                  These controls describe what the backend must perform after successful payment.
                </p>
              </div>
            </div>

            <div className="catalog-readiness-grid">
              <ReadinessItem icon={CreditCard} title="Payment verified" text="Provisioning should only start after webhook-confirmed payment." />
              <ReadinessItem icon={PlugZap} title="Adapter selected" text="The product selects the adapter family; the plan maps exact package." />
              <ReadinessItem icon={RefreshCcw} title="Renewal ready" text="Renewal invoice should use the same product/plan pricing source." />
              <ReadinessItem icon={FileText} title="Welcome email" text="After provisioning, backend should send the correct email template." />
            </div>

            <ApiBox
              title="Backend endpoints to connect"
              lines={[
                "GET    /api/v1/admin/products/{id}/",
                "PATCH  /api/v1/admin/products/{id}/",
                "POST   /api/v1/admin/products/",
                "GET    /api/v1/admin/providers/",
                "POST   /api/v1/admin/provisioning/queue/{id}/run/",
              ]}
            />
          </Card>
        ) : null}

        {activeTab === "Visibility" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Visibility & Related Plans</h2>
                <p>
                  This confirms where the product appears and which plans are connected to it.
                </p>
              </div>
            </div>

            <div className="catalog-related-grid">
              {relatedPlans.length ? (
                relatedPlans.map((plan) => (
                  <a className="catalog-related-card" href={`/admin/plans/${plan.id}`} key={plan.id}>
                    <span><ListChecks size={18} /></span>
                    <div>
                      <strong>{plan.name}</strong>
                      <p>{money(plan.price)}/{plan.cycle} · {plan.cycles.length} cycles</p>
                    </div>
                  </a>
                ))
              ) : (
                <div className="empty-state">
                  No plan is currently connected to this product. Create a plan and map it to this product.
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="catalog-side-stack">
        <Card padded>
          <div className="catalog-side-title">
            <Sparkles size={18} />
            <strong>Implementation Notes</strong>
          </div>
          <p className="catalog-side-text">
            Product data should come from the backend catalog module. Frontend mock data should
            only be fallback during development.
          </p>
        </Card>

        <Card padded>
          <div className="catalog-side-title">
            <ShieldCheck size={18} />
            <strong>Client Safety</strong>
          </div>
          <p className="catalog-side-text">
            Customers should see product benefits, renewal terms and service controls — not adapter
            class names or provider credentials.
          </p>
        </Card>

        <Card padded>
          <div className="catalog-side-title">
            <Eye size={18} />
            <strong>Connected Areas</strong>
          </div>
          <div className="catalog-link-list">
            <a href="/admin/plans">Plans</a>
            <a href="/client/order">Client order page</a>
            <a href="/client/order/checkout">Checkout</a>
            <a href="/admin/provisioning">Provisioning queue</a>
          </div>
        </Card>
      </aside>
    </div>
  );
}

export function PlanDetailEditor({
  mode,
  plan,
}: {
  mode: EditorMode;
  plan?: Partial<CatalogPlan>;
}) {
  const [activeTab, setActiveTab] = useState<(typeof planTabs)[number]>("Overview");

  const value: CatalogPlan = {
    id: plan?.id ?? "new-plan",
    name: plan?.name ?? "New Plan",
    product: plan?.product ?? "Web Hosting",
    currency: plan?.currency ?? "NGN",
    price: plan?.price ?? 0,
    cycle: plan?.cycle ?? "mo",
    storage: plan?.storage ?? "",
    bandwidth: plan?.bandwidth ?? "",
    websites: plan?.websites ?? "",
    emails: plan?.emails ?? "",
    databases: plan?.databases ?? "",
    ssl: plan?.ssl ?? false,
    popular: plan?.popular ?? false,
    adapter: plan?.adapter ?? "DirectAdminAdapter",
    features: plan?.features ?? [
      "Customer-facing feature one",
      "Customer-facing feature two",
      "Automation-ready package mapping",
    ],
    cycles: plan?.cycles ?? [
      { label: "1 Month", price: 0 },
      { label: "12 Months", price: 0 },
    ],
  };

  const productOptions = products.map((product) => product.name);
  const adapterOptions = adapters.map((adapter) => adapter.name);
  const selectedProduct = products.find((product) => product.name === value.product);

  return (
    <div className="catalog-detail-grid">
      <div className="catalog-main-stack">
        <Card padded>
          <div className="catalog-hero-card">
            <div className="catalog-hero-top">
              <span className="catalog-hero-icon">
                <ListChecks size={24} />
              </span>
              <div>
                <p className="eyebrow">Catalog Plan</p>
                <h1>{mode === "new" ? "Create Plan" : value.name}</h1>
                <p>
                  Plans control price, billing cycle, feature list, provider package mapping,
                  checkout display and provisioning behavior.
                </p>
              </div>
            </div>

            <div className="catalog-status-row">
              <PremiumStatusPill status="Active" />
              <span>{value.id}</span>
              <span>{value.product}</span>
              <span>{value.adapter}</span>
            </div>
          </div>
        </Card>

        <div className="catalog-tabs">
          {planTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "catalog-tab active" : "catalog-tab"}
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
                <h2>Plan Information</h2>
                <p>
                  This plan must sync with checkout, invoices, renewals, service creation and
                  provider package mapping.
                </p>
              </div>
              <Button href="/admin/plans" variant="secondary">Back</Button>
            </div>

            <div className="catalog-form-grid">
              <Field label="Plan ID / Slug" value={value.id} />
              <Field label="Plan Name" value={value.name} />
              <SelectField label="Product" value={value.product} options={productOptions} />
              <SelectField label="Status" value="Active" options={["Active", "Inactive", "Planned", "Archived"]} />
              <SelectField label="Popular Badge" value={value.popular ? "Yes" : "No"} options={["Yes", "No"]} />
              <SelectField label="Public Visibility" value="Visible in checkout" options={["Visible in checkout", "Hidden from checkout", "Admin only"]} />
              <Field label="Storage" value={value.storage} placeholder="10 GB SSD" />
              <Field label="Bandwidth" value={value.bandwidth} placeholder="100 GB" />
              <Field label="Websites" value={value.websites} placeholder="1 website" />
              <Field label="Emails" value={value.emails} placeholder="5 mailboxes" />
              <Field label="Databases" value={value.databases} placeholder="3 databases" />
              <SelectField label="Free SSL Included" value={value.ssl ? "Yes" : "No"} options={["Yes", "No"]} />
            </div>

            <div className="page-actions">
              <Button href="/admin/plans" variant="secondary">Cancel</Button>
              <Button type="button">{mode === "new" ? "Create Plan" : "Save Plan"}</Button>
            </div>
          </Card>
        ) : null}

        {activeTab === "Pricing" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Pricing & Billing Cycles</h2>
                <p>
                  Backend must recalculate final checkout amount. Frontend preview should never
                  be trusted as final invoice value.
                </p>
              </div>
            </div>

            <div className="catalog-form-grid">
              <SelectField label="Currency" value={value.currency} options={["NGN", "USD", "GBP"]} />
              <Field label="Base Price" value={value.price} type="number" />
              <SelectField label="Default Cycle" value={value.cycle} options={["mo", "yr", "one-time"]} />
              <Field label="Setup Fee" value={0} type="number" />
            </div>

            <div className="catalog-cycle-grid">
              {value.cycles.map((cycle) => (
                <div className="catalog-cycle-card" key={cycle.label}>
                  <span>{cycle.label}</span>
                  <strong>{money(cycle.price)}</strong>
                  <small>Editable from backend plan price table</small>
                </div>
              ))}
            </div>

            <ApiBox
              title="Pricing endpoints"
              lines={[
                "GET   /api/v1/admin/plans/{id}/prices/",
                "PATCH /api/v1/admin/plans/{id}/prices/",
                "POST  /api/v1/catalog/coupons/validate/",
              ]}
            />
          </Card>
        ) : null}

        {activeTab === "Features" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Feature List</h2>
                <p>
                  These features are customer-facing and should appear consistently on the main
                  website, client order page and checkout summary.
                </p>
              </div>
            </div>

            <TextAreaField
              label="Features"
              value={value.features.join("\n")}
              helper="One feature per line. Backend should store features with sort order."
            />

            <div className="catalog-feature-preview">
              {value.features.map((feature) => (
                <div key={feature}>
                  <CheckCircle2 size={16} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {activeTab === "Provider Mapping" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Provider Package Mapping</h2>
                <p>
                  This is where the admin maps Octalve plan to DirectAdmin/cPanel/VPS provider
                  package. This is admin-only and should not appear to clients.
                </p>
              </div>
            </div>

            <div className="catalog-form-grid">
              <SelectField label="Adapter Type" value={value.adapter} options={adapterOptions} />
              <Field label="Provider Package Name" value={value.id} helper="Example: DirectAdmin package name." />
              <Field label="Server Group" value={`${value.product.toLowerCase().replaceAll(" ", "-")}-default`} />
              <Field label="Welcome Email Template" value={`${value.name} Welcome Email`} />
              <TextAreaField
                label="Provisioning Metadata"
                value={`product=${value.product}\nplan=${value.name}\nadapter=${value.adapter}\npackage=${value.id}`}
              />
            </div>

            <div className="catalog-readiness-grid">
              <ReadinessItem icon={Package} title="Product connected" text={selectedProduct ? `${selectedProduct.name} is selected.` : "Select a product."} />
              <ReadinessItem icon={Layers} title="Plan mapped" text="Map this plan to provider package before live provisioning." />
              <ReadinessItem icon={PlugZap} title="Adapter-ready" text="DirectAdmin first; other adapters can follow same contract." />
              <ReadinessItem icon={ShieldCheck} title="Secrets protected" text="Provider credentials must remain backend-only." />
            </div>
          </Card>
        ) : null}

        {activeTab === "Automation" ? (
          <Card padded>
            <div className="section-heading">
              <div>
                <h2>Provisioning Automation</h2>
                <p>
                  This plan should create services only after payment is verified and a
                  provisioning task is queued.
                </p>
              </div>
            </div>

            <div className="catalog-readiness-grid">
              <ReadinessItem icon={CreditCard} title="Invoice paid" text="Payment webhook confirms invoice before provisioning." />
              <ReadinessItem icon={PlugZap} title="Task queued" text="ProvisioningTask is created with action provision." />
              <ReadinessItem icon={BadgeCheck} title="Service activated" text="Service becomes active after provider success response." />
              <ReadinessItem icon={FileText} title="Email sent" text="Customer receives welcome email with safe service details." />
            </div>

            <ApiBox
              title="Plan backend endpoints"
              lines={[
                "GET    /api/v1/admin/plans/{id}/",
                "PATCH  /api/v1/admin/plans/{id}/",
                "POST   /api/v1/admin/plans/",
                "POST   /api/v1/admin/providers/{id}/test-connection/",
                "POST   /api/v1/admin/provisioning/queue/{id}/run/",
              ]}
            />
          </Card>
        ) : null}
      </div>

      <aside className="catalog-side-stack">
        <Card padded>
          <div className="catalog-side-title">
            <Globe2 size={18} />
            <strong>Checkout Sync</strong>
          </div>
          <p className="catalog-side-text">
            This plan should appear in checkout only when status is active and public visibility
            is enabled.
          </p>
        </Card>

        <Card padded>
          <div className="catalog-side-title">
            <CreditCard size={18} />
            <strong>Billing Sync</strong>
          </div>
          <p className="catalog-side-text">
            Invoice totals, renewals and coupon validation must be recalculated on the backend.
          </p>
        </Card>

        <Card padded>
          <div className="catalog-side-title">
            <PlugZap size={18} />
            <strong>Provider Sync</strong>
          </div>
          <p className="catalog-side-text">
            The plan should map to the exact DirectAdmin/cPanel/VPS package before live sales.
          </p>
        </Card>

        <Card padded>
          <div className="catalog-side-title">
            <Eye size={18} />
            <strong>Quick Links</strong>
          </div>
          <div className="catalog-link-list">
            <a href="/admin/products">Products</a>
            <a href="/client/order">Client order</a>
            <a href={`/client/order/checkout?plan=${value.id}`}>Preview checkout</a>
            <a href="/admin/settings/providers">Providers</a>
          </div>
        </Card>
      </aside>
    </div>
  );
}
