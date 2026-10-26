"use client";
import Image from "next/image";
import Link from "next/link";
import {useState} from "react";

/** The approved logo is stored in frontend/public/branding/octalve-cloud-logo.png.
 * Constrain its natural proportions: approximately 30% smaller than the old 190px logo.
 * Padding belongs to the image container, never the source artwork.
 */
export function CloudBrandLogo({href="/client"}:{href?:string}){
 const [src,setSrc]=useState("/branding/octalve-cloud-logo.png");
 return <Link href={href} aria-label="Octalve Cloud home"
    className="flex h-16 w-full min-w-0 items-center justify-start px-14 py-3 focus-visible:outline-2 focus-visible:outline-blue-600">
   <span className="flex h-full w-full max-w-[133px] items-center justify-start overflow-hidden">
     <Image src={src} alt="Octalve Cloud" width={133} height={34} unoptimized priority
       onError={()=>{if(src!=="/assets/logo/octalve.png")setSrc("/assets/logo/octalve.png");}}
       className="block h-auto max-h-9 w-full object-contain object-left"/>
   </span>
 </Link>;
}
