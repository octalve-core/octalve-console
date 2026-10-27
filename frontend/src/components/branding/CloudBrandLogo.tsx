"use client";
import Image from "next/image";
import Link from "next/link";
import {useState} from "react";

/** The approved logo is stored in frontend/public/branding/octalve-cloud-logo.png.
 * Constrain its natural proportions: approximately 30% smaller than the old 190px logo.
 * Padding belongs to the image container, never the source artwork.
 */
export function CloudBrandLogo({href="/client",variant="sidebar"}:{href?:string;variant?:"sidebar"|"auth"}){
 const [src,setSrc]=useState("/branding/octalve-cloud-logo.png");
 const isAuth=variant==="auth";
 return <Link href={href} aria-label="Octalve Cloud home"
    className={isAuth
      ?"inline-flex min-h-16 max-w-full items-center justify-center rounded-2xl bg-white px-5 py-3 focus-visible:outline-2 focus-visible:outline-console-primary"
      :"flex h-16 w-full min-w-0 items-center justify-start px-14 py-3 focus-visible:outline-2 focus-visible:outline-blue-600"}>
   <span className={isAuth
      ?"flex h-11 w-[175px] max-w-full items-center justify-center overflow-hidden"
      :"flex h-full w-full max-w-[133px] items-center justify-start overflow-hidden"}>
     <Image src={src} alt="Octalve Cloud" width={175} height={45} unoptimized priority
       onError={()=>{if(src!=="/assets/logo/octalve.png")setSrc("/assets/logo/octalve.png");}}
       className={isAuth?"block h-auto max-h-11 w-full object-contain object-center":"block h-auto max-h-9 w-full object-contain object-left"}/>
   </span>
 </Link>;
}
