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
      className="dashboard-promo-card"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(0,100,224,0.94), rgba(61,111,234,0.86)), url(${active.image})`,
      }}
    >
      <div className="dashboard-promo-copy">
        <span className="dashboard-promo-eyebrow">{active.eyebrow}</span>
        <h2 className="dashboard-promo-title">{active.title}</h2>
        <p className="dashboard-promo-description">{active.description}</p>

        <div className="dashboard-promo-actions">
          <Link href={active.href} className="dashboard-promo-link">
            {active.ctaLabel}
            <ExternalLink size={16} />
          </Link>

          <div className="dashboard-promo-nav">
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

        <div className="dashboard-promo-dots">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to banner ${index + 1}`}
              className={index === activeIndex ? "active" : ""}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
