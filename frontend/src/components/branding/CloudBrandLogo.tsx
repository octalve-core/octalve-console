"use client";
import Image from "next/image";
import Link from "next/link";
import {useState} from "react";

/** Upload the approved logo to frontend/public/branding/octalve-cloud-logo.png.
 * The existing Octalve asset is a safe interim image if the new file
 * has not been uploaded yet. Never render a fabricated mark or brand text.
 */
export function CloudBrandLogo({href="/client"}:{href?:string}){
  const [src,setSrc]=useState("/branding/octalve-cloud-logo.png");
  return <Link href={href} aria-label="Octalve Cloud home" className="flex h-16 items-center px-4 focus-visible:outline-2 focus-visible:outline-[#0064E0]">
    <Image src={src} alt="Octalve Cloud" width={190} height={49} unoptimized priority
      onError={()=>{if(src!=="/assets/logo/octalve.png")setSrc("/assets/logo/octalve.png");}}
      className="h-auto max-h-12 w-auto max-w-[190px] object-contain" />
  </Link>;
}
