"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Download,
  ShieldCheck,
  Wallet,
  Zap
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

type LedgerType = "Credit" | "Debit";

type LedgerRow = {
  id: string;
  date: string;
  description: string;
  type: LedgerType;
  gateway: string;
  amount: number;
  status: string;
};

const ledgerRows: LedgerRow[] = [
  {
    id: "WL-1001",
    date: "Apr 30, 2026",
    description: "Wallet deposit through Paystack",
    type: "Credit",
    gateway: "Paystack",
    amount: 4500,
    status: "Successful"
  },
  {
    id: "WL-1002",
    date: "Apr 30, 2026",
    description: "Invoice payment for Business hosting",
    type: "Debit",
    gateway: "Wallet Balance",
    amount: 3500,
    status: "Applied"
  }
];

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

function exportWalletLedger(rows: LedgerRow[]) {
  const headers = ["ID", "Date", "Description", "Type", "Gateway", "Amount", "Status"];

  const csv = [
    headers,
    ...rows.map((row) => [
      row.id,
      row.date,
      row.description,
      row.type,
      row.gateway,
      String(row.amount),
      row.status
    ])
  ]
    .map((line) =>
      line
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "octalve-wallet-ledger.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [depositAmount, setDepositAmount] = useState("");
  const [gateway, setGateway] = useState("Paystack");

  const walletSummary = useMemo(() => {
    const credits = ledgerRows
      .filter((row) => row.type === "Credit")
      .reduce((total, row) => total + row.amount, 0);

    const debits = ledgerRows
      .filter((row) => row.type === "Debit")
      .reduce((total, row) => total + row.amount, 0);

    return {
      balance: credits - debits,
      credits,
      debits
    };
  }, []);

  return (
    <main className="page-container">
      <PageHeader
        title="Wallet"
        description="Deposit funds, view wallet balance, track ledger movements and use wallet credit for invoices and renewals."
      />

      <div className="wallet-layout">
        <Card padded>
          <div className="wallet-balance-card">
            <div>
              <p>Available balance</p>
              <strong>{formatNaira(walletSummary.balance)}</strong>
              <span>
                Wallet funds can be used for invoices, renewals and manual credits.
              </span>
            </div>

            <div className="wallet-balance-icon">
              <Wallet size={30} />
            </div>
          </div>

          <div className="wallet-mini-grid">
            <div>
              <ArrowDownLeft size={18} />
              <span>Total credits</span>
              <strong>{formatNaira(walletSummary.credits)}</strong>
            </div>

            <div>
              <ArrowUpRight size={18} />
              <span>Total debits</span>
              <strong>{formatNaira(walletSummary.debits)}</strong>
            </div>

            <div>
              <ShieldCheck size={18} />
              <span>Auto-pay</span>
              <strong>Ready</strong>
            </div>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Deposit funds</h2>
              <p>Select amount and payment gateway to fund your wallet securely.</p>
            </div>
          </div>

          <form className="stacked-form">
            <label className="form-field">
              <span className="form-label">Deposit amount</span>
              <input
                className="input"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                inputMode="numeric"
                placeholder="Enter amount"
              />
            </label>

            <label className="form-field">
              <span className="form-label">Gateway</span>
              <select
                className="select"
                value={gateway}
                onChange={(event) => setGateway(event.target.value)}
              >
                <option>Paystack</option>
                <option>Flutterwave</option>
                <option>Bank Transfer</option>
                <option>Manual Payment</option>
              </select>
            </label>

            <div className="page-actions">
              <button type="button" className="button">
                Deposit Funds
              </button>
            </div>
          </form>
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Wallet rules</h2>
              <p>These rules help customers understand how wallet credit works.</p>
            </div>
          </div>

          <ul className="wallet-rules">
            <li>
              <Zap size={17} />
              Automatically pay recurring invoices when wallet balance is enough.
            </li>
            <li>
              <ArrowDownLeft size={17} />
              Deposit funds through enabled gateways.
            </li>
            <li>
              <CalendarClock size={17} />
              Every wallet movement appears in the ledger.
            </li>
            <li>
              <ShieldCheck size={17} />
              Manual credits require staff or admin approval.
            </li>
          </ul>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Wallet actions</h2>
              <p>Quick customer actions for wallet funding and invoice support.</p>
            </div>
          </div>

          <div className="module-grid wallet-action-grid">
            <button type="button" className="module-card">
              <h3>Fund wallet</h3>
              <p>Add wallet credit using Paystack, Flutterwave or bank transfer.</p>
            </button>

            <button type="button" className="module-card">
              <h3>Pay invoice</h3>
              <p>Use wallet credit to settle eligible unpaid invoices.</p>
            </button>

            <button type="button" className="module-card">
              <h3>Request support</h3>
              <p>Ask support to review wallet payment or ledger movement.</p>
            </button>
          </div>
        </Card>
      </div>

      <Card padded style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <h2>Wallet ledger</h2>
            <p>Transparent credit and debit history for client confidence.</p>
          </div>

          <button
            type="button"
            className="button secondary"
            onClick={() => exportWalletLedger(ledgerRows)}
          >
            <Download size={17} />
            Export
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Gateway</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {ledgerRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.date}</td>
                  <td>{row.description}</td>
                  <td>
                    <span className={row.type === "Credit" ? "badge green" : "badge orange"}>
                      {row.type}
                    </span>
                  </td>
                  <td>{row.gateway}</td>
                  <td>{formatNaira(row.amount)}</td>
                  <td>
                    <span className="badge green">{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
