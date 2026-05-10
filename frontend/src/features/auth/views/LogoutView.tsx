"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function LogoutView() {
  const router = useRouter();
  const { logout } = useAuth();
  const [message, setMessage] = useState("Signing you out...");

  useEffect(() => {
    let active = true;

    async function runLogout() {
      try {
        await logout();
        if (!active) return;
        setMessage("Logout successful. Redirecting to login...");
        router.replace("/login");
      } catch {
        if (!active) return;
        setMessage("Logout completed locally. Redirecting to login...");
        router.replace("/login");
      }
    }

    runLogout();

    return () => {
      active = false;
    };
  }, [logout, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
          <LogOut className="h-7 w-7" />
        </div>

        <h1 className="mt-6 text-2xl font-medium tracking-[-0.04em] text-slate-950">
          Logging out
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Please wait
        </div>
      </div>
    </main>
  );
}