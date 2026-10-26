
type StaffHeroProps = {
  name?: string;
};

export function StaffHero({ name = "Staff" }: StaffHeroProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(110deg,#001426_0%,#073C7A_90%)] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
      <div className="relative">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-white/10 blur-xl" />

        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-white/85">YOUR OCTALVE CLOUD WORKSPACE</p>

          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
            Welcome {name} 👋
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Handle customer requests, review orders, monitor provisioning, and keep Octalve Cloud operations moving.
          </p>

        </div>
      </div>
    </section>
  );
}