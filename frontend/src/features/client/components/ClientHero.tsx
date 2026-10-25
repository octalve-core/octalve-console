import { Plus, ShoppingCart, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ClientHeroProps = {
  name?: string;
};

export function ClientHero({ name = "Client" }: ClientHeroProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE9FD] bg-[#EFF6FF] p-5 text-[#142A43] sm:p-7">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#0064E0]/5 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-[#0064E0]/5 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-slate-500">Good morning,</p>

          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Welcome {name} 👋
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Here is what is happening with your hosting services, invoices, domains,
            wallet, and support tickets today.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button href="/client/order" variant="soft" className="border border-[#D4E3F6] bg-white text-[#0064E0] hover:bg-[#E8F2FF]">
              <ShoppingCart className="h-4 w-4" />
              Buy service
            </Button>

            <Button href="/client/support/new" variant="soft" className="border border-[#D4E3F6] bg-white text-[#0064E0] hover:bg-[#E8F2FF]">
              <Plus className="h-4 w-4" />
              Open ticket
            </Button>

            <Button href="/client/support" variant="soft" className="border border-[#D4E3F6] bg-white text-[#0064E0] hover:bg-[#E8F2FF]">
              <Ticket className="h-4 w-4" />
              View support
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}