"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
};

const trustPoints = [
  "Secure client, admin, and staff access",
  "Built for hosting automation workflows",
  "Connected to the Django API contract",
];

export function AuthShell({ children, title, description, eyebrow = "Octalve Console" }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href={routes.home} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#0064E0]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0064E0] shadow-sm">
              O
            </span>
            Octalve Console
          </Link>

          <div className="mt-14 max-w-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <ShieldCheck className="h-7 w-7" />
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#0064E0]">
              {eyebrow}
            </p>

            <h1 className="mt-4 text-5xl font-medium tracking-[-0.06em] text-slate-950">
              Hosting automation, structured for growth.
            </h1>

            <p className="mt-5 text-base leading-8 text-slate-500">
              A premium control center for managing customers, hosting services, domains, invoices,
              providers, provisioning, and support operations.
            </p>

            <div className="mt-8 grid gap-3">
              {trustPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <h2 className="mt-6 text-3xl font-medium tracking-[-0.04em] text-slate-950">
                {title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
