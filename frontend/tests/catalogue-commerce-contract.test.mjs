import test from "node:test";
import assert from "node:assert/strict";
import {parsePlanFeatureLines,parseSupplierCostLines} from "../src/features/admin/catalog/catalogue-input.ts";
import {sanitizeCommerceNext} from "../src/lib/commerce/sanitize-commerce-next.ts";

test("supplier cost Enter newlines, CRLF and safe amounts",()=>{
 assert.deepEqual(parseSupplierCostLines("1mo=1500\n12mo=15000"),{"1mo":"1500","12mo":"15000"});
 assert.deepEqual(parseSupplierCostLines("1mo=1500.25\r\n3mo=4000.50"),{"1mo":"1500.25","3mo":"4000.50"});
 assert.deepEqual(parseSupplierCostLines(""),{});
 for(const bad of ["1mo=0","1mo=-50","1mo=1e2","1mo=1200.999","1mo=200\n1mo=300","once=5","1mo=NaN"])
  assert.throws(()=>parseSupplierCostLines(bad),undefined,bad);
});
test("features Enter newline become individually validated feature rows",()=>{
 assert.deepEqual(parsePlanFeatureLines("Storage: 10 GB\nPriority support\r\nSSL: verified"),[
  {label:"Storage",value:"10 GB",is_highlighted:true},
  {label:"Priority support",value:"",is_highlighted:true},
  {label:"SSL",value:"verified",is_highlighted:true}
 ]);
 for(const bad of [": 10GB","Storage: ","Storage\nStorage", "x".repeat(101)])
  assert.throws(()=>parsePlanFeatureLines(bad),undefined,bad);
 assert.throws(()=>parsePlanFeatureLines(Array.from({length:41},(_,i)=>"Feature"+i).join("\n")));
});
test("only well-formed Client purchase/domain intents survive authentication",()=>{
 const ok="/client/order?product=shared-web-hosting&plan=octalve-business&cycle=12mo&revision=2";
 assert.equal(sanitizeCommerceNext(ok),ok);
 assert.equal(sanitizeCommerceNext("/client/order?plan=45&cycle=1mo"),"/client/order?plan=45&cycle=1mo");
 assert.equal(sanitizeCommerceNext("/client/domains/register?domain=example.com.ng"),"/client/domains/register?domain=example.com.ng");
 for(const bad of ["https://evil.test/client/order","//evil.test/","/admin/settings",
   "/client/order?product=shared-web-hosting&plan=octalve-business&cycle=bogus",
   "/client/order?product=shared-web-hosting&plan=octalve-business",
   "/client/order?plan=20&cycle=1mo&revision=0",
   "/client/order?plan=20&plan=21&cycle=1mo",
   "/client/order?plan=20&cycle=1mo&price=1",
   "/client/domains/register?domain=not%20a%20domain",
   "/client/order%2f..%2fadmin","/client/order\\evil"]){
  assert.equal(sanitizeCommerceNext(bad),"",bad);
 }
});
