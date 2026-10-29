import Image from "next/image";

/** Legacy-sidebar compatibility: the real Cloud logo replaces decorative CSS dots. */
export function BrandMark() {
  return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white" aria-label="Octalve Cloud">
    <Image src="/branding/octalve-cloud-logo.png" alt="" width={88} height={32}
      unoptimized className="h-auto w-full object-contain"/>
  </span>;
}
