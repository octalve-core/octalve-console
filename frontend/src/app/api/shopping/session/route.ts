import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_ACCESS_COOKIE, SESSION_REFRESH_COOKIE, resolveCloudApiBase } from "@/lib/api/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STORE = "https://cloud.octalve.com";
const API = "https://api.cloud.octalve.com/api";
const HEADERS = {
  "Access-Control-Allow-Origin": STORE,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-shopping-scope",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Origin",
};
function allowed(request: NextRequest) {
  return request.headers.get("origin") === STORE;
}
function reply(status: number, detail?: string) {
  return detail ? NextResponse.json({detail}, {status, headers:HEADERS}) : new NextResponse(null,{status,headers:HEADERS});
}
function scopeFor(refresh:string){return createHash("sha256").update("octalve-shopping-scope-v1:"+refresh).digest("hex");}
function sameScope(scope:string, received:string){
  return /^[a-f0-9]{64}$/.test(received)&&timingSafeEqual(Buffer.from(scope,"hex"),Buffer.from(received,"hex"));
}
export function OPTIONS(request:NextRequest){
  return allowed(request)?reply(204):new NextResponse(null,{status:403});
}
async function handle(request:NextRequest){
  // This is the only credentialed cross-origin BFF route. No generic proxy,
  // caller-selected targets, token responses or session cookie rotation.
  if(!allowed(request))return new NextResponse(null,{status:403});
  const access=request.cookies.get(SESSION_ACCESS_COOKIE)?.value;
  const refresh=request.cookies.get(SESSION_REFRESH_COOKIE)?.value;
  if(!access&&!refresh)return reply(204);
  if(!access||!refresh)return reply(409,"Reopen your Console session.");
  if(resolveCloudApiBase()!==API)return reply(503,"Shopping unavailable.");
  const scope=scopeFor(refresh);
  let body:string|undefined;
  if(request.method!=="GET"){
    if(!sameScope(scope,request.headers.get("x-shopping-scope")||""))return reply(409,"Shopping session changed.");
    if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))return reply(415,"JSON required.");
    const length=Number(request.headers.get("content-length")||"0");
    if(length>8192)return reply(413,"Shopping request too large.");
    const reader=request.body?.getReader();
    if(!reader)return reply(400,"Shopping request required.");
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply(413,"Shopping request too large.");}chunks.push(value);}}
    catch{return reply(400,"Invalid shopping request.");}
    body=Buffer.concat(chunks).toString("utf8");
    try{JSON.parse(body);}catch{return reply(400,"Invalid shopping request.");}
  }
  try{
    const r=await fetch(API+"/orders/shopping/storefront-account/",{method:request.method,
      headers:{Authorization:"Bearer "+access,"X-Octalve-Shopping-Session":refresh,"Content-Type":"application/json",Accept:"application/json"},
      body,cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(18000)});
    if(r.status===404)return reply(404,"Unified shopping unavailable.");
    if(r.status===401||r.status===403)return reply(409,"Reopen your Console session.");
    if(!r.ok)return reply(r.status===400?400:r.status===429?429:503,"Shopping request could not be completed.");
    const value=await r.json();
    if(!value||!Array.isArray(value.lines))return reply(502,"Invalid shopping response.");
    // Forward only the approved cart snapshot; no account profile or credentials.
    return NextResponse.json({lines:value.lines,subtotal:value.subtotal??null,currency:value.currency??null,domains:Array.isArray(value.domains)?value.domains:[],scope},{headers:HEADERS});
  }catch{return reply(503,"Shopping unavailable.");}
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
