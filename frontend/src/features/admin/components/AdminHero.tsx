import { ArrowUpRight, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

type AdminHeroProps = {
  name?: string;
};

export function AdminHero({ name = "Admin" }: AdminHeroProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(110deg,#001426_0%,#073C7A_90%)] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-white/10 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-white/85">Good morning,</p>
          <h2 className="mt-3 text-4xl font-medium tracking-[-0.06em] sm:text-5xl">
            Welcome {name} 👋
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Here is what is happening across customers, hosting services, invoices,
            domains, providers, and provisioning today.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/admin/orders/new" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <Plus className="h-4 w-4" />
              Create order
            </Button>

            <Button href="/admin/provisioning" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <Zap className="h-4 w-4" />
              Check queue
            </Button>

            <Button href="/admin/reports" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <ArrowUpRight className="h-4 w-4" />
              View reports
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}