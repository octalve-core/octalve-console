
type AdminHeroProps = {
  name?: string;
};

export function AdminHero({ name = "Admin" }: AdminHeroProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#001A36] bg-gradient-to-r from-[#001A36] via-[#062B52] to-[#06427A] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-white/10 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-white/85">YOUR OCTALVE CLOUD WORKSPACE</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
            Welcome {name} 👋
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Here is what is happening across customers, hosting services, invoices,
            domains, providers, and provisioning today.
          </p>

        </div>
      </div>
    </section>
  );
}