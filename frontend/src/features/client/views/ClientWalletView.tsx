"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { clientApi } from "@/lib/api/endpoints";
import { formatCurrency } from "@/lib/formatters";

export function ClientWalletView() {
  const [balance, setBalance] = useState(0);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      try {
        const wallet = await clientApi.wallet();

        if (!active) return;

        const value = Number((wallet as { available?: unknown })?.available ?? 0);
        setBalance(Number.isFinite(value) ? value : 0);
        setIsFallback(false);
      } catch {
        if (!active) return;
        setBalance(0);
        setIsFallback(true);
      }
    }

    loadWallet();

    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell
      role="client"
      title="Wallet"
      description="Manage account balance, deposits, and service payments."
      actions={
        <Button type="button">
          <Plus className="h-4 w-4" />
          Fund wallet
        </Button>
      }
    >
      <DashboardPage
        eyebrow="Wallet"
        title="Wallet balance"
        description="Fund your wallet and apply credit to invoices and service renewals."
      >
        <div className="space-y-5">
          {isFallback ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Live wallet API is not available yet. Showing safe default balance.
            </div>
          ) : null}

          <ResponsiveGrid columns="3">
            <MetricCard
              label="Available balance"
              value={formatCurrency(balance)}
              description="Wallet credit available for payments"
              icon={<WalletCards className="h-5 w-5" />}
            />
            <MetricCard
              label="Pending deposits"
              value={formatCurrency(0)}
              description="Deposits awaiting confirmation"
              icon={<CreditCard className="h-5 w-5" />}
            />
            <MetricCard
              label="Applied credits"
              value={formatCurrency(0)}
              description="Credits applied to invoices"
              icon={<ReceiptText className="h-5 w-5" />}
            />
          </ResponsiveGrid>

          <Card>
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Wallet activity</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Wallet transactions, deposits, invoice applications, and credit history will appear here when the backend returns live activity data.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}