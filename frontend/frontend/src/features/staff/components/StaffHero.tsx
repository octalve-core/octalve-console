import { LifeBuoy, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

type StaffHeroProps = {
  name?: string;
};

export function StaffHero({ name = "Staff" }: StaffHeroProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#0064E0] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-white/10 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-white/85">Good morning,</p>

          <h2 className="mt-3 text-4xl font-medium tracking-[-0.06em] sm:text-5xl">
            Welcome {name} 👋
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Handle customer requests, review orders, monitor provisioning, and keep Octalve Cloud operations moving.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/staff/tickets" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <LifeBuoy className="h-4 w-4" />
              View tickets
            </Button>

            <Button href="/staff/provisioning" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <Zap className="h-4 w-4" />
              Provisioning
            </Button>

            <Button href="/staff/security" variant="soft" className="bg-white/15 text-white hover:bg-white/20">
              <ShieldCheck className="h-4 w-4" />
              Security
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}