"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CreditCard,
  Globe2,
  Lock,
  Mail,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles
} from "lucide-react";
import {
  applyConsoleCoupon,
  buildConsolePlanCtaHref,
  calculateConsolePlanPricing,
  calculateConsolePlanTotal,
  consoleBillingCycles,
  consoleCatalogPlans,
  consolePriceCategories,
  DEFAULT_CONSOLE_BILLING_CYCLE,
  formatNaira,
  getConsoleCatalogPlan,
  type ConsoleBillingCycleKey,
  type ConsolePackageCategoryKey
} from "@/lib/console-pricing";
import { Card } from "@/components/ui/Card";

type CheckoutFlowProps = {
  initialPlanId?: string;
  initialCycle?: string;
};

type DomainMode = "existing" | "register" | "transfer";

const addOnPlanIds = ["askssl-starter", "private-email", "free-migration-review"];

function normalizeCycle(value?: string): ConsoleBillingCycleKey {
  return consoleBillingCycles.some((cycle) => cycle.key === value)
    ? (value as ConsoleBillingCycleKey)
    : DEFAULT_CONSOLE_BILLING_CYCLE;
}

function canAttachDomain(category: ConsolePackageCategoryKey) {
  return ["hosting", "wordpress", "email", "security", "vps"].includes(category);
}

export function CheckoutFlow({ initialPlanId, initialCycle }: CheckoutFlowProps) {
  const initialPlan = getConsoleCatalogPlan(initialPlanId);

  const [selectedCategory, setSelectedCategory] =
    useState<ConsolePackageCategoryKey>(initialPlan.category);
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlan.id);
  const [billingCycle, setBillingCycle] = useState<ConsoleBillingCycleKey>(
    normalizeCycle(initialCycle)
  );

  const [domainMode, setDomainMode] = useState<DomainMode>("existing");
  const [domainName, setDomainName] = useState("");
  const [domainMessage, setDomainMessage] = useState(
    "Domain availability and DNS actions will be confirmed by the live domain provider during backend checkout."
  );

  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Paystack");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedPlan = getConsoleCatalogPlan(selectedPlanId);
  const displayPrice = calculateConsolePlanPricing(selectedPlan, billingCycle);

  const visiblePlans = useMemo(() => {
    return consoleCatalogPlans.filter((plan) => plan.category === selectedCategory);
  }, [selectedCategory]);

  const addOnPlans = useMemo(() => {
    return addOnPlanIds
      .map((id) => getConsoleCatalogPlan(id))
      .filter((plan) => plan.id !== selectedPlan.id);
  }, [selectedPlan.id]);

  const domainPlan = getConsoleCatalogPlan("domain-com");
  const domainShouldAttach = canAttachDomain(selectedPlan.category);
  const domainCharge =
    domainShouldAttach && domainMode === "register"
      ? calculateConsolePlanTotal(domainPlan, billingCycle)
      : 0;

  const mainTotal = calculateConsolePlanTotal(selectedPlan, billingCycle);

  const selectedAddOnPlans = addOnPlans.filter((plan) =>
    selectedAddOns.includes(plan.id)
  );

  const addOnTotal = selectedAddOnPlans.reduce(
    (total, plan) => total + calculateConsolePlanTotal(plan, billingCycle),
    0
  );

  const subtotal = mainTotal + addOnTotal + domainCharge;
  const couponResult = appliedCouponCode
    ? applyConsoleCoupon(appliedCouponCode, subtotal, selectedPlan.category)
    : { valid: false, discount: 0, message: "" };

  const discount = couponResult.valid ? couponResult.discount : 0;
  const tax = 0;
  const totalDue = Math.max(0, subtotal - discount + tax);

  function handleCategoryChange(category: ConsolePackageCategoryKey) {
    setSelectedCategory(category);
    const firstPlan = consoleCatalogPlans.find((plan) => plan.category === category);

    if (firstPlan) {
      setSelectedPlanId(firstPlan.id);
    }
  }

  function handlePlanChange(planId: string) {
    const nextPlan = getConsoleCatalogPlan(planId);
    setSelectedPlanId(nextPlan.id);
    setSelectedCategory(nextPlan.category);
  }

  function toggleAddOn(planId: string) {
    setSelectedAddOns((current) =>
      current.includes(planId)
        ? current.filter((id) => id !== planId)
        : [...current, planId]
    );
  }

  function handleDomainSearch() {
    if (!domainName.trim()) {
      setDomainMessage("Enter a domain name first, for example yourbrand.com.");
      return;
    }

    setDomainMessage(
      `${domainName.trim()} will be checked through the connected domain provider during live checkout.`
    );
  }

  function handleApplyCoupon() {
    setAppliedCouponCode(couponInput);
  }

  function handlePayNow() {
    const checkoutPayload = {
      plan_id: selectedPlan.id,
      product: selectedPlan.product,
      billing_cycle: billingCycle,
      domain: {
        mode: domainMode,
        name: domainName,
        attach_to_service: domainShouldAttach
      },
      add_ons: selectedAddOnPlans.map((plan) => ({
        plan_id: plan.id,
        product: plan.product
      })),
      coupon_code: appliedCouponCode || null,
      payment_method: paymentMethod,
      amount: {
        subtotal,
        discount,
        tax,
        total: totalDue,
        currency: "NGN"
      },
      automation: {
        adapter: selectedPlan.adapter,
        provider_package: selectedPlan.providerPackage,
        welcome_template: selectedPlan.welcomeTemplate,
        event: selectedPlan.automationEvent
      }
    };

    console.log("Octalve checkout payload", checkoutPayload);
    setStatusMessage(
      "Checkout payload prepared. When backend is connected, this button will create order, invoice, payment session and provisioning task."
    );
  }

  return (
    <main className="page-container">
      <div className="checkout-v2-header">
        <div>
          <p className="eyebrow">Octalve Console</p>
          <h1>Checkout</h1>
          <p>
            Complete your order with plan selection, domain setup, billing cycle,
            coupon, add-ons and payment method.
          </p>
        </div>
      </div>

      <div className="checkout-v2-steps">
        <span className="active">1. Product</span>
        <span className="active">2. Domain</span>
        <span className="active">3. Add-ons</span>
        <span className="active">4. Payment</span>
      </div>

      <div className="checkout-v2-layout">
        <div className="checkout-v2-main">
          <Card padded>
            <div className="checkout-v2-section-title">
              <ShoppingCart size={22} />
              <div>
                <h2>Choose package</h2>
                <p>
                  You can change package type, selected plan and billing cycle
                  without going back.
                </p>
              </div>
            </div>

            <div className="checkout-v2-controls">
              <label>
                <span>Product category</span>
                <select
                  value={selectedCategory}
                  onChange={(event) =>
                    handleCategoryChange(event.target.value as ConsolePackageCategoryKey)
                  }
                >
                  {consolePriceCategories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </label>

              <label>
                <span>Package</span>
                <select
                  value={selectedPlan.id}
                  onChange={(event) => handlePlanChange(event.target.value)}
                >
                  {visiblePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </label>

              <label>
                <span>Billing cycle</span>
                <select
                  value={billingCycle}
                  onChange={(event) =>
                    setBillingCycle(event.target.value as ConsoleBillingCycleKey)
                  }
                  disabled={selectedPlan.pricing.kind === "fixed"}
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

            <div className="checkout-selected-plan">
              <div>
                <span>{selectedPlan.product}</span>
                <h3>{selectedPlan.name}</h3>
                <p>{selectedPlan.description}</p>
              </div>

              <div>
                {displayPrice.regularPriceLabel ? (
                  <small>{displayPrice.regularPriceLabel}</small>
                ) : null}
                <strong>
                  {displayPrice.priceLabel}
                  <em>{displayPrice.suffix}</em>
                </strong>
                {displayPrice.totalLabel ? <p>{displayPrice.totalLabel}</p> : null}
              </div>
            </div>

            <div className="checkout-clean-automation">
              <PackageCheck size={18} />
              <span>
                Automated provisioning after payment. The technical provider mapping is handled securely by Octalve Console.
              </span>
            </div>
          </Card>

          {domainShouldAttach ? (
            <Card padded>
              <div className="checkout-v2-section-title">
                <Globe2 size={22} />
                <div>
                  <h2>Choose domain</h2>
                  <p>
                    Use your existing domain, register a new one, or transfer an
                    active domain into Octalve Cloud.
                  </p>
                </div>
              </div>

              <div className="domain-mode-grid">
                {[
                  {
                    key: "existing",
                    title: "Use existing domain",
                    text: "I already own this domain"
                  },
                  {
                    key: "register",
                    title: "Register new domain",
                    text: "Search and register a new domain"
                  },
                  {
                    key: "transfer",
                    title: "Transfer domain",
                    text: "Move domain to Octalve Cloud"
                  }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDomainMode(item.key as DomainMode)}
                    className={
                      domainMode === item.key
                        ? "domain-mode-card active"
                        : "domain-mode-card"
                    }
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>

              <div className="domain-search-v2">
                <input
                  value={domainName}
                  onChange={(event) => setDomainName(event.target.value)}
                  placeholder="yourdomain.com"
                />
                <button type="button" onClick={handleDomainSearch}>
                  <Search size={16} />
                  Search
                </button>
              </div>

              <p className="checkout-helper-text">{domainMessage}</p>

              {domainMode === "register" ? (
                <div className="checkout-domain-price">
                  <span>Domain registration add-on</span>
                  <strong>{formatNaira(domainCharge)}</strong>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card padded>
            <div className="checkout-v2-section-title">
              <Sparkles size={22} />
              <div>
                <h2>Recommended add-ons</h2>
                <p>
                  Add SSL, email or migration support directly from checkout.
                  These are also mapped to the same backend catalog.
                </p>
              </div>
            </div>

            <div className="checkout-addon-grid">
              {addOnPlans.map((plan) => {
                const isSelected = selectedAddOns.includes(plan.id);
                const price = calculateConsolePlanTotal(plan, billingCycle);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => toggleAddOn(plan.id)}
                    className={isSelected ? "checkout-addon-card active" : "checkout-addon-card"}
                  >
                    <div>
                      {plan.category === "security" ? <ShieldCheck size={18} /> : null}
                      {plan.category === "email" ? <Mail size={18} /> : null}
                      {plan.category === "promos" ? <Sparkles size={18} /> : null}
                      <strong>{plan.name}</strong>
                    </div>
                    <span>{plan.product}</span>
                    <p>{formatNaira(price)}</p>
                    {isSelected ? (
                      <small>
                        <Check size={14} />
                        Added
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <aside className="checkout-v2-summary">
          <Card padded>
            <div className="checkout-summary-head-v2">
              <h2>Order Details</h2>
              <span>Secure checkout</span>
            </div>

            <div className="checkout-line">
              <span>{selectedPlan.name}</span>
              <strong>{formatNaira(mainTotal)}</strong>
            </div>

            {domainCharge > 0 ? (
              <div className="checkout-line">
                <span>.com domain registration</span>
                <strong>{formatNaira(domainCharge)}</strong>
              </div>
            ) : null}

            {selectedAddOnPlans.map((plan) => (
              <div className="checkout-line" key={plan.id}>
                <span>{plan.name}</span>
                <strong>{formatNaira(calculateConsolePlanTotal(plan, billingCycle))}</strong>
              </div>
            ))}

            <div className="checkout-coupon">
              <label>
                <span>Have a coupon?</span>
                <div>
                  <input
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                    placeholder="OCTALVE10"
                  />
                  <button type="button" onClick={handleApplyCoupon}>
                    Apply
                  </button>
                </div>
              </label>

              {appliedCouponCode ? (
                <p className={couponResult.valid ? "good" : "bad"}>
                  {couponResult.message}
                </p>
              ) : null}
            </div>

            <div className="checkout-line">
              <span>Subtotal</span>
              <strong>{formatNaira(subtotal)}</strong>
            </div>

            <div className="checkout-line">
              <span>Discount</span>
              <strong>-{formatNaira(discount)}</strong>
            </div>

            <div className="checkout-line">
              <span>Tax</span>
              <strong>{formatNaira(tax)}</strong>
            </div>

            <div className="checkout-total-box-v2">
              <span>Total due today</span>
              <strong>{formatNaira(totalDue)}</strong>
            </div>

            <div className="payment-methods-v2">
              <p>Select payment method</p>
              {["Paystack", "Flutterwave", "Wallet", "Bank Transfer"].map((method) => (
                <label
                  key={method}
                  className={paymentMethod === method ? "payment-option-v2 active" : "payment-option-v2"}
                >
                  <span>
                    {method === "Wallet" ? <Lock size={16} /> : <CreditCard size={16} />}
                    {method}
                  </span>
                  <input
                    type="radio"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                </label>
              ))}
            </div>

            <button type="button" className="checkout-pay-btn-v2" onClick={handlePayNow}>
              <Lock size={17} />
              Pay Now
            </button>

            {statusMessage ? <p className="checkout-status-note">{statusMessage}</p> : null}

            <p className="checkout-secure-note-v2">
              Payment will create an invoice, order record and provisioning task after confirmation.
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}

