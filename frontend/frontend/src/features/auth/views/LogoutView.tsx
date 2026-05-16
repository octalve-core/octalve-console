"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function LogoutView() {
  const router = useRouter();
  const { logout } = useAuth();
  const [message, setMessage] = useState("Signing you out securely...");

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

        setMessage("Session cleared. Redirecting to login...");
        router.replace("/login");
      }
    }

    runLogout();

    return () => {
      active = false;
    };
  }, [logout, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F7FC] px-4 py-10 text-[#061330]">
      <section className="w-full max-w-md rounded-[2rem] border border-[#D7E3F2] bg-white p-8 text-center shadow-[0_24px_90px_rgba(15,23,42,0.10)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#0064E0]/10 text-[#0064E0]">
          <LogOut className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-3xl font-medium tracking-[-0.06em] text-[#061330]">
          Logging out
        </h1>

        <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-7 text-slate-500">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Please wait
        </div>
      </section>
    </main>
  );
}