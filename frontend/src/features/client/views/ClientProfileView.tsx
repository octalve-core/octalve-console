"use client";

import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";

export function ClientProfileView() {
  const { user } = useAuth();

  return (
    <DashboardShell
      role="client"
      title="Profile"
      description="Review your account information and client access."
    >
      <DashboardPage
        eyebrow="Account"
        title="Account profile"
        description="View your account information and keep your contact details up to date."
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#0064E0]/10 text-[#0064E0]">
                <UserRound className="h-7 w-7" />
              </div>

              <div>
                <h2 className="text-2xl font-medium tracking-[-0.04em] text-slate-950">
                  {user?.name ?? user?.full_name ?? "Octalve Client"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{user?.email ?? "Email unavailable"}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p className="mt-2 text-sm font-medium text-slate-950">{user?.email ?? "—"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  Role
                </div>
                <p className="mt-2 text-sm font-medium capitalize text-slate-950">{user?.role ?? "client"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Account security</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your account and sign-in details help keep your services secure. Contact support if you need assistance.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}