"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Headphones,
  RefreshCcw,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildConsolePlanCtaHref,
  calculateConsolePlanPricing,
  consoleBillingCycles,
  consolePriceCategories,
  consoleCatalogPlans,
  DEFAULT_CONSOLE_BILLING_CYCLE,
  type ConsoleBillingCycleKey,
  type ConsolePackageCategoryKey
} from "@/lib/console-pricing";
import { Button } from "@/components/ui/Button";

const INITIAL_VISIBLE_FEATURES = 7;

const benefitItems = [
  { label: "Automatic provisioning-ready", icon: Zap },
  { label: "24/7 support structure", icon: Headphones },
  { label: "Upgrade anytime", icon: RefreshCcw }
];

export function PlanCards({ admin = false }: { admin?: boolean }) {
  const [activeCategory, setActiveCategory] = useState<ConsolePackageCategoryKey>("hosting");
  const [billingCycle, setBillingCycle] = useState<ConsoleBillingCycleKey>(DEFAULT_CONSOLE_BILLING_CYCLE);
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

  const activeCategoryData =
    consolePriceCategories.find((item) => item.key === activeCategory) ?? consolePriceCategories[0];

  const visiblePlans = useMemo(() => {
    return consoleCatalogPlans.filter((plan) => plan.category === activeCategory);
  }, [activeCategory]);

  function togglePlan(planId: string) {
    setExpandedPlans((current) => ({
      ...current,
      [planId]: !current[planId]
    }));
  }

  return (
    <section className="console-packages">
      <div className="console-package-hero">
        <p className="eyebrow">Packages</p>
        <h2>{admin ? "Manage customer-facing packages and automation mapping." : "Choose the right cloud package for your business."}</h2>
        <p>
          {admin
            ? "Products, pricing, billing cycles, provider packages, welcome emails and provisioning events should stay connected from one clean catalog."
            : "Choose domains, hosting, email, WordPress, security and VPS services from one Octalve Cloud experience."}
        </p>

        <div className="console-benefits">
          {benefitItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <Icon size={16} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="console-package-controls">
        <div>
          <label className="console-mobile-label">Choose package type</label>
          <select
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value as ConsolePackageCategoryKey)}
            className="console-category-select"
          >
            {consolePriceCategories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>

          <div className="console-category-tabs">
            {consolePriceCategories.map((category) => {
              const isActive = activeCategory === category.key;

              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setActiveCategory(category.key)}
                  className={isActive ? "console-category-tab active" : "console-category-tab"}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="console-cycle-select-wrap">
          <span>Length of subscription</span>
          <select
            value={billingCycle}
            onChange={(event) => setBillingCycle(event.target.value as ConsoleBillingCycleKey)}
          >
            {consoleBillingCycles.map((cycle) => (
              <option key={cycle.key} value={cycle.key}>
                {cycle.label}
                {cycle.badge ? ` — ${cycle.badge}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
      </div>

      <div className="console-category-summary">
        <strong>{activeCategoryData.label}</strong>
        <p>{activeCategoryData.description}</p>
      </div>

      <div className="console-pricing-grid">
        {visiblePlans.map((plan) => {
          const displayPrice = calculateConsolePlanPricing(plan, billingCycle);
          const ctaHref = buildConsolePlanCtaHref(plan, billingCycle);
          const isExpanded = Boolean(expandedPlans[plan.id]);

          const visibleFeatures = isExpanded
            ? plan.features
            : plan.features.slice(0, INITIAL_VISIBLE_FEATURES);

          return (
            <article
              key={plan.id}
              className={plan.popular ? "console-price-card popular" : "console-price-card"}
            >
              {plan.popular ? <div className="console-popular-strip">Most Popular</div> : null}

              <div className={plan.popular ? "console-price-card-inner has-strip" : "console-price-card-inner"}>
                <div className="console-plan-head">
                  <div>
                    {plan.eyebrow ? <p>{plan.eyebrow}</p> : null}
                    <h3>{plan.name}</h3>
                  </div>

                  <div className="console-plan-badges">
                    {plan.badge ? <span className="console-green-pill">{plan.badge}</span> : null}
                    {displayPrice.discountPercent ? (
                      <span className="console-blue-pill">{displayPrice.discountPercent}% off</span>
                    ) : null}
                  </div>
                </div>

                <p className="console-plan-description">{plan.description}</p>

                <div className="console-price-block">
                  {displayPrice.regularPriceLabel ? (
                    <p className="console-regular-price">{displayPrice.regularPriceLabel}</p>
                  ) : null}

                  <div>
                    <strong>{displayPrice.priceLabel}</strong>
                    <span>{displayPrice.suffix}</span>
                  </div>

                  {displayPrice.totalLabel ? <p>{displayPrice.totalLabel}</p> : null}
                  {displayPrice.renewsLabel ? <small>{displayPrice.renewsLabel}</small> : null}
                </div>

                <div className="console-plan-actions">
                  {admin ? (
                    <>
                      <Button href={`/admin/plans/${plan.id}`} variant="secondary">
                        Edit Plan
                      </Button>
                      <Button href={`/admin/plans/${plan.id}`}>
                        Mapping
                      </Button>
                    </>
                  ) : (
                    <Link className={plan.popular ? "console-plan-cta primary" : "console-plan-cta"} href={ctaHref}>
                      {plan.ctaLabel ?? "Choose plan"}
                    </Link>
                  )}
                </div>

                {admin ? (
                  <div className="console-automation-box">
                    <div>
                      <span>Product</span>
                      <strong>{plan.product}</strong>
                    </div>
                    <div>
                      <span>Adapter</span>
                      <strong>{plan.adapter}</strong>
                    </div>
                    <div>
                      <span>Provider Package</span>
                      <strong>{plan.providerPackage}</strong>
                    </div>
                    <div>
                      <span>Welcome Email</span>
                      <strong>{plan.welcomeTemplate}</strong>
                    </div>
                    <div className="full">
                      <span>Automation Event</span>
                      <strong>{plan.automationEvent}</strong>
                    </div>
                  </div>
                ) : null}

                {plan.finePrint ? <p className="console-fine-print">{plan.finePrint}</p> : null}

                <div className="console-feature-list-wrap">
                  <ul className="console-feature-list">
                    {visibleFeatures.map((feature) => (
                      <li key={feature}>
                        <span>
                          <Check size={14} />
                        </span>
                        <strong>{feature}</strong>
                      </li>
                    ))}
                  </ul>

                  {plan.features.length > INITIAL_VISIBLE_FEATURES ? (
                    <button
                      type="button"
                      onClick={() => togglePlan(plan.id)}
                      className="console-show-more"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Show less" : "Show more"}
                      <ChevronDown className={isExpanded ? "rotate" : ""} size={16} />
                    </button>
                  ) : null}
                </div>

                {plan.popular ? <div className="console-card-glow" aria-hidden="true" /> : null}

                <div className="console-card-watermark" aria-hidden="true">
                  <BadgeCheck size={92} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {admin ? (
        <div className="console-catalog-note">
          <ShieldCheck size={18} />
          <p>
            Backend rule: provider packages should be imported from adapters, but selling price, discount, tax, billing cycle,
            invoice rule and welcome email must remain controlled inside Octalve Console.
          </p>
        </div>
      ) : null}
    </section>
  );
}


