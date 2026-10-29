"use strict";
/** Execute the real Next middleware after TypeScript transpilation with mocked
 * platform transport. This test never reaches Django or manipulates browser JWTs.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");
const source=fs.readFileSync(path.resolve(__dirname,"../src/proxy.ts"),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const commerceExports={};
const commerceSource=fs.readFileSync(path.resolve(__dirname,"../src/lib/commerce/sanitize-commerce-next.ts"),"utf8");
const commerceJS=ts.transpileModule(commerceSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
vm.runInNewContext(commerceJS,{exports:commerceExports,URL,URLSearchParams},{filename:"commerce-sanitizer.test.js",timeout:2000});
const cookies=[];
class MockNextResponse{
  constructor(body="",opts={}){this.body=body;this.status=opts.status||200;this.headers={...(opts.headers||{})};
    this.headers.set=(key,value)=>{this.headers[key]=value;};
    this.cookies={set:(name,value,config)=>cookies.push({name,value,config})};}
  static redirect(url){const r=new MockNextResponse("",{status:307});r.location=String(url);return r;}
  static next(){return new MockNextResponse("",{status:200});}
}
const calls=[];
let fetchImpl=()=>{throw new Error("Network outage")};
const context={
  exports:{},
  require:module=>{if(module==="next/server")return {NextResponse:MockNextResponse};
    if(module==="./lib/commerce/sanitize-commerce-next")return commerceExports;
    throw Error(module);},
  process:{env:{NODE_ENV:"test",NEXT_PUBLIC_API_BASE_URL:"https://console-api.example.test/api"}},
  URL,URLSearchParams,AbortSignal,
  fetch:(...args)=>{calls.push(args);return fetchImpl(...args);}
};
vm.runInNewContext(output,context,{filename:"proxy.test.js",timeout:2000});
const {proxy}=context.exports;
function request(path,access="fake-access",refresh="fake-refresh"){
  const url="https://console.example.test"+path;
  const nextUrl=new URL(url);
  nextUrl.clone=()=>new URL(url);
  return {nextUrl,cookies:{get:name=>name.endsWith("_access")?(access?{value:access}:undefined)
       :name.endsWith("_refresh")?(refresh?{value:refresh}:undefined):undefined}};
}
function reply(status,payload){
 return {status,ok:status>=200&&status<300,json:async()=>payload};
}
async function check(){
 cookies.length=0;
 let response=await proxy(request("/admin"));
 assert.equal(response.status,503,"outage returns retryable 503");
 assert.equal(cookies.length,0,"outage cannot delete cookies");
 assert.equal(response.headers["Cache-Control"],"private, no-store");
 assert.equal(response.headers["Retry-After"],"10");
 cookies.length=0;
 response=await proxy(request("/login"));
 assert.equal(response.status,503,"login entry must not clear a session during outage");
 assert.equal(cookies.length,0);
 cookies.length=0;
 fetchImpl=async url=>url.includes("/users/me/")?reply(401,{}):reply(503,{});
 response=await proxy(request("/admin"));
 assert.equal(response.status,503,"temporary refresh backend outage is not revocation");
 assert.equal(cookies.length,0);
 cookies.length=0;
 fetchImpl=async()=>reply(401,{});
 response=await proxy(request("/admin"));
 assert.equal(response.status,307,"explicit token rejection routes to login");
 assert.ok(response.location.includes("/login?next="));
 assert.ok(cookies.some(x=>x.name==="octalve_console_access"&&x.config.maxAge===0));
 cookies.length=0;
 fetchImpl=async()=>reply(200,{id:1,email:"synthetic-admin@example.test",role:"admin",is_superuser:true});
 response=await proxy(request("/admin"));
 assert.equal(response.status,200);
 assert.ok(!cookies.some(x=>x.config.maxAge===0),"valid auth must not clear cookies");
 cookies.length=0;
 fetchImpl=async url=>url.includes("/users/me/")?
  (calls.filter(x=>String(x[0]).includes("/users/me/")).length===1
  ?reply(401,{}):reply(200,{id:1,email:"synthetic-admin@example.test",role:"admin",is_superuser:true}))
  :reply(200,{access:"new-access",refresh:"new-refresh"});
 calls.length=0;
 response=await proxy(request("/admin"));
 assert.equal(response.status,200,"verified refresh recovers access");
 assert.ok(cookies.some(x=>x.name==="octalve_console_access"&&x.value==="new-access"));
 fetchImpl=async()=>reply(200,{id:8,email:"synthetic-client@example.test",role:"client"});
 const continuation="/client/order?product=shared-web-hosting&plan=octalve-business&cycle=12mo&revision=3";
 response=await proxy(request("/login?next="+encodeURIComponent(continuation)));
 assert.equal(response.status,307);
 assert.equal(new URL(response.location).pathname+new URL(response.location).search,continuation,
  "already signed-in Client must resume the exact validated cart selection");
 response=await proxy(request("/login?next="+encodeURIComponent("//outside.example.test/admin")));
 assert.equal(new URL(response.location).pathname,"/client","malicious redirect must fail closed");
 console.log("PASS: live middleware outage, rejection, recovery and cookie preservation.");
}
check().catch(error=>{console.error(error);process.exitCode=1});
