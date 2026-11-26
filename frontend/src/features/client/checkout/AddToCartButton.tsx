"use client";
import {useState} from "react";
import Link from "next/link";
import {primary,secondary} from "@/components/shared-commerce/CommerceUI";
import {addToCart,type CartSelection} from "./cart-selections";

export function AddToCartButton({item,className,onAdded}:{item:CartSelection;className?:string;onAdded?:()=>void}){
  const [state,setState]=useState<"ready"|"busy"|"added"|"error">("ready");
  async function add(){
    setState("busy");
    try {await addToCart(item);setState("added");onAdded?.();}
    catch {setState("error");}
  }
  return <div className={className}>
    {state==="added"&&!onAdded?<Link href="/client/order/checkout?view=cart" className={secondary+" w-full"}>View cart</Link>:
      <button type="button" disabled={state==="busy"} onClick={()=>void add()} className={primary+" w-full"}>
        {state==="busy"?"Adding…":"Add to cart"}
      </button>}
    {state==="error"&&<p role="alert" className="mt-2 text-xs text-rose-700">Couldn’t add this item. Check your account and try again.</p>}
  </div>;
}
