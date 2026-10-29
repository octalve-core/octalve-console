import Link from "next/link";
import { ArrowLeft, Home, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F4F8FF] px-4 py-10 text-[#06142F] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-[#D8E5F7] bg-white shadow-[0_24px_80px_rgba(0,37,84,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-[#06142F] px-8 py-10 text-white sm:px-10 lg:px-12">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ShieldAlert className="h-7 w-7 text-[#4FA3FF]" />
            </div>

            <p className="mt-10 text-xs font-medium uppercase tracking-[0.35em] text-[#AFC8EF]">
              Octalve Console
            </p>

            <h1 className="mt-5 max-w-md text-4xl font-medium tracking-[-0.06em] sm:text-5xl">
              This page is not available.
            </h1>

            <p className="mt-5 max-w-md text-base leading-8 text-[#D5E4FF]">
              The page may have been moved, removed, or the link may be incorrect.
              Return to the secure login page to continue managing your cloud services.
            </p>

            <div className="mt-12 h-px w-full bg-white/10" />
          </div>

          <div className="flex flex-col justify-center px-8 py-10 sm:px-10 lg:px-14">
            <div className="inline-flex w-fit rounded-full bg-[#EAF3FF] px-4 py-2 text-sm font-medium text-[#0064E0]">
              Error 404
            </div>

            <h2 className="mt-6 text-3xl font-medium tracking-[-0.05em] text-[#06142F]">
              Let’s get you back on track.
            </h2>

            <p className="mt-4 max-w-lg text-base leading-7 text-[#64748B]">
              Use the button below to return to the Octalve Console login page.
              If you were trying to access a dashboard area, sign in again and continue from your workspace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0064E0] px-6 py-4 text-sm font-medium text-white shadow-[0_16px_40px_rgba(0,100,224,0.24)] transition hover:bg-[#0056C2]"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to login
              </Link>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D8E5F7] bg-white px-6 py-4 text-sm font-medium text-[#06142F] transition hover:border-[#0064E0]/40 hover:text-[#0064E0]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to console home
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
