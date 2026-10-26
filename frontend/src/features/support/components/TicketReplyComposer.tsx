"use client";
import type {FormEvent} from "react";
import {Send} from "lucide-react";
import {TextAreaField} from "@/components/design-system/TextAreaField";
import {ActionButton} from "@/components/design-system/ActionButton";
export function TicketReplyComposer({role,reply,internal,busy,onReplyChange,onInternalChange,onSubmit}:{
 role:"client"|"staff"|"admin";reply:string;internal:boolean;busy:boolean;
 onReplyChange:(value:string)=>void;onInternalChange:(value:boolean)=>void;
 onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
}){
 return <form onSubmit={onSubmit} className="border-t border-console-line pt-5">
  <TextAreaField id="ticket-reply" label="Write a reply" name="reply" required
   maxLength={20000} rows={5} value={reply} className="min-h-40"
   onChange={event=>onReplyChange(event.target.value)} placeholder="Write a helpful response…"/>
  <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
   {role!=="client"?<label className="flex min-h-10 items-center gap-2 text-sm text-console-muted">
    <input type="checkbox" checked={internal} onChange={event=>onInternalChange(event.target.checked)}
     className="h-4 w-4 accent-console-primary"/>
    Internal note (hidden from customer)
   </label>:<span className="text-xs text-console-muted">Your reply is visible to authorized support staff.</span>}
   <ActionButton type="submit" loading={busy} disabled={!reply.trim()} className="w-full sm:w-auto"
    leadingIcon={<Send aria-hidden="true" className="h-4 w-4"/>}>{busy?"Sending…":"Send reply"}</ActionButton>
  </div>
 </form>;
}
