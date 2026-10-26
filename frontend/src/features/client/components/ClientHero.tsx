
type ClientHeroProps = {
  name?: string;
};

export function ClientHero({ name = "Client" }: ClientHeroProps) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-[#153A69] bg-[linear-gradient(112deg,#00172E_0%,#062D5D_65%,#0064E0_150%)] p-6 text-white shadow-[0_18px_40px_rgba(0,22,54,.09)] sm:p-7">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#0064E0]/5 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-[#0064E0]/5 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-blue-200">YOUR OCTALVE CLOUD WORKSPACE</p>

          <h2 className="mt-3 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
            Welcome {name} 👋
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
            Here is what is happening with your hosting services, invoices, domains,
            wallet, and support tickets today.
          </p>

        </div>
      </div>
    </section>
  );
}