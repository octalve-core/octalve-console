// src/components/modules/client/ClientPromoCarousel.tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

export type PromoSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  image: string;
};

export function ClientPromoCarousel({ slides }: { slides: PromoSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const active = slides[activeIndex];

  function goToPrevious() {
    setActiveIndex((current) =>
      current === 0 ? slides.length - 1 : current - 1,
    );
  }

  function goToNext() {
    setActiveIndex((current) => (current + 1) % slides.length);
  }

  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-2xl bg-console-primary bg-cover bg-center text-white shadow-sm"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(0,100,224,0.94), rgba(61,111,234,0.86)), url(${active.image})`,
      }}
    >
      <div className="max-w-3xl p-4 sm:p-6">
        <span className="text-[11px] font-medium uppercase tracking-widest text-white/80">{active.eyebrow}</span>
        <h2 className="mt-2 text-xl font-medium leading-7 sm:text-2xl">{active.title}</h2>
        <p className="mt-2 max-w-xl text-[13px] leading-5 text-white/90">{active.description}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link href={active.href} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-console-primary hover:bg-slate-50">
            {active.ctaLabel}
            <ExternalLink size={16} />
          </Link>

          <div className="flex items-center gap-2 [&_button]:inline-flex [&_button]:h-9 [&_button]:w-9 [&_button]:items-center [&_button]:justify-center [&_button]:rounded-lg [&_button]:border [&_button]:border-white/40 [&_button]:hover:bg-white/20">
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Previous banner"
            >
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={goToNext} aria-label="Next banner">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 [&_button]:h-2 [&_button]:w-2 [&_button]:rounded-full [&_button]:bg-white/50">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to banner ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              className={index === activeIndex ? "!w-5 !bg-white" : ""}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
