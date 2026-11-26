"use client";
import {useState} from "react";
import Link from "next/link";
import {primary,secondary} from "@/components/shared-commerce/CommerceUI";
import {addToCart,type CartSelection} from "./cart-selections";

export function AddToCartButton({item,className,onAdded}:{item:CartSelection;className?:string;onAdded?:()=>void}){
  const [state,setState]=useState<"ready"|"busy"|"added"|"error">("ready");
  const [message,setMessage]=useState("");
  async function add(){
    setMessage("");
    setState("busy");
    try {await addToCart(item);setState("added");onAdded?.();}
    catch(reason) {setMessage(reason instanceof Error?reason.message:"Could not add this item. Please retry.");setState("error");}
  }
  return <div className={className}>
    {state==="added"&&!onAdded?<Link href="/client/order/checkout?view=cart" className={secondary+" w-full"}>View cart</Link>:
      <button type="button" disabled={state==="busy"} onClick={()=>void add()} className={primary+" w-full"}>
        {state==="busy"?"Adding…":"Add to cart"}
      </button>}
    {state==="error"&&<p role="alert" className="mt-2 text-xs text-rose-700">{message}</p>}
  </div>;
}
