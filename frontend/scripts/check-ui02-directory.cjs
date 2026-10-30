"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const front=path.resolve(__dirname,".."),root=path.join(front,"src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
async function main(){
 const url=pathToFileURL(path.join(root,"features/admin/utils/admin-record-normalizer.ts")).href;
 const {normalizeAdminRecord,unwrapAdminList}=await import(url);
 const valid={id:12,full_name:"Example Customer",email:"customer@example.invalid",
  company_name:"Example Limited",status:"active",role:"client",date_joined:"2026-10-28T11:20:30Z",
  wallet_balance:1500.5,services_count:2,total_invoices:3000,unpaid_invoices:0};
 const row=normalizeAdminRecord(valid,"customers");
 assert.equal(row.title,valid.full_name,"Customer name must not be replaced with email");
 assert.equal(row.subtitle,valid.email);
 assert.equal(row.companyName,valid.company_name);
 assert.equal(row.meta,valid.company_name,"Status is not a reference or category");
 assert.equal(row.status,"active");
 assert.equal(row.dateISO,"2026-10-28");
 assert.equal(row.amount,"1,500.50","Only explicit wallet balance is shown; never invoice sum");
 assert.equal(row.reference,"Customer #12");
 assert.equal(row.actionHref,"/admin/customers/12");
 const anonymous=normalizeAdminRecord({...valid,full_name:"",company_name:"",wallet_balance:null},"customers");
 assert.equal(anonymous.title,valid.email,"Email fallback is only for missing actual name");
 assert.equal(anonymous.amount,undefined,"Absent wallet balance must not become synthetic 0");
 assert.equal(anonymous.companyName,"—");
 assert.throws(()=>normalizeAdminRecord({...valid,id:null},"customers"),/identifier/i);
 assert.throws(()=>unwrapAdminList({unexpected:[]}),/Invalid authorized API list/);
 assert.equal(unwrapAdminList({results:[valid]}).length,1);
 const staffUrl=pathToFileURL(path.join(root,"features/staff/utils/staff-record-normalizer.ts")).href;
 const {normalizeStaffRecord}=await import(staffUrl);
 const staff=normalizeStaffRecord(valid,"customers");
 assert.equal(staff.title,valid.full_name);
 assert.equal(staff.subtitle,valid.email);
 assert.notEqual(staff.meta,"active","Staff status cannot be repeated as a reference");
 assert.equal(staff.status,"active");
 assert.equal(staff.date,valid.date_joined);

 const serializer=fs.readFileSync(path.resolve(front,"../backend/accounts/serializers.py"),"utf8");
 const start=serializer.indexOf("class CustomerListSerializer("),end=serializer.indexOf("class CustomerDetailSerializer(");
 if(start<0||end<=start)throw Error("Customer serializer not located");
 const section=serializer.slice(start,end);
 for(const name of ["full_name","company_name","email","date_joined","wallet_balance","status","services_count"])
  if(!section.includes("'"+name+"'")&&!section.includes(" "+name+" ="))throw Error("Django customer field missing: "+name);
 const view=fs.readFileSync(path.resolve(front,"../backend/accounts/views.py"),"utf8");
 if(!view.includes("class AdminCustomerListView(")||!view.includes("class IsCloudCustomerAdmin(IsAdminUser)")||!view.includes("permission_classes = [IsCloudCustomerAdmin]"))
  throw Error("Backend customer privilege boundary missing");
 const files=["types.ts","RecordDirectory.tsx","DirectoryToolbar.tsx","StatusTabs.tsx",
  "DesktopRecordTable.tsx","MobileRecordCard.tsx","RecordActionSheet.tsx","DirectoryFilterSheet.tsx","DirectoryPagination.tsx"];
 for(const file of files){
  const source=read("components/design-system/record-directory/"+file);
  if(source.split("\n").length>250)throw Error("Oversized reusable directory component: "+file);
  if(/\b(markPaid|authorizeOpanel|provisionNow|refundNow)\b|localStorage|sessionStorage/.test(source))
   throw Error("Directory may not own business/session authority: "+file);
 }
 const toolbar=read("components/design-system/record-directory/DirectoryToolbar.tsx");
 if(!toolbar.includes("onExport?<button")||!toolbar.includes("create?<Link"))
  throw Error("Export/Create require explicit verified capability");
 const sheet=read("components/design-system/AdaptiveSheet.tsx");
 if(!sheet.includes("showModal()")||!sheet.includes("safe-area-inset-bottom")||!sheet.includes("onCancel"))
  throw Error("Native focus-trapped adaptive sheet regressed");
 const global=read("app/globals.css");
 if(global.split("\n").length>300)throw Error("Global CSS retirement cap violated");
 console.log("PASS: UI-02 customer contract, typed adapter, privileges, no fake mutations, accessible Tailwind primitives.");
 console.log("PENDING: actual authenticated 320,360,390,768,1024,1440px screenshots; full UI-03 server pagination/aggregation.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
