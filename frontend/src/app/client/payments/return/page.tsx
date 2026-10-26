import Link from "next/link";

export const metadata = {
  title: "Payment confirmation pending | Octalve Cloud",
  description: "Hosted checkout return: payment status is verified separately.",
};

/**
 * A gateway redirect is never financial truth. Do not parse status,
 * tx_ref, reference, or amount from the browser URL to activate hosting.
 * Console's independently verified invoice state is the only authority.
 */
export default function HostedPaymentReturnPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-6 inline-flex rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          Octalve Cloud · Secure checkout
        </div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
          We’re confirming your payment
        </h1>
        <p className="mb-5 text-sm leading-7 text-slate-600">
          Returning from the payment provider does not automatically mean the
          invoice has been paid. Octalve Console independently confirms the
          gateway transaction before marking your order as paid.
        </p>
        <div className="mb-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Your hosting service will become eligible for activation only after
          confirmed payment and verification of the actual hosting account.
          Please do not repeat the payment while confirmation is pending.
        </div>
        <Link
          href="/client/orders"
          className="inline-flex items-center justify-center rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0052B8]"
        >
          View my orders
        </Link>
        <p className="mt-5 text-xs text-slate-500">
          If payment was debited but your invoice remains unpaid, contact
          Octalve support with your order number. Do not send card details.
        </p>
      </div>
    </main>
  );
}
