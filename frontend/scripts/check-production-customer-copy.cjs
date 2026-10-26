#!/usr/bin/env node
// Prevent internal API/engineering copy and fabricated customer-state regressions.
// This checks production-facing sources only; no network or secrets are used.
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../src");
const cases=[
  ["features/client/views/ClientDashboardView.tsx",[
    /Fetching your account summary from the API/i,
    /Loading client dashboard/i,
    /clientDemo\./,
    /getListCount\(invoices\.value\)/,
  ]],
  ["features/client/views/ClientResourceListView.tsx",[/Connecting to the Django API/i]],
  ["features/client/views/ClientResourceDetailView.tsx",[
    /Fetching your record from the Django API/i,
    /API-ready client detail route/i,
    /href:\s*"#"/,
    /href:\s*"\/client\/order\/checkout"/,
  ]],
  ["features/client/views/ClientOrderView.tsx",[
    /Only active plans and prices provided by the Octalve Cloud catalog are shown/i,
  ]],
  ["features/client/views/ClientWalletView.tsx",[
    /Showing safe default balance/i,
    /Pending deposits/i,
    /Applied credits/i,
    /Fund wallet/i,
  ]],
  ["features/client/views/ClientProfileView.tsx",[
    /provided by the Django authentication API/i,
    /client@example\.com/,
  ]],
  ["components/layout/DashboardShell.tsx",[
    /Search customers, invoices, domains\.\.\./,
    /24\/7 cloud support/,
    /aria-label="Notifications"/,
  ]],
  ["features/client/utils/client-record-normalizer.ts",[
    /Math\.random\(\)/,
    /score: resource === "services"/,
  ]],
];
let failures=0;
for(const [filename,patterns] of cases){
 const file=path.join(root,filename);
 const content=fs.readFileSync(file,"utf8");
 for(const pattern of patterns){
  if(pattern.test(content)){
    console.error("FAIL customer copy/authority:",filename,String(pattern));
    failures++;
  }
 }
}
const dashboard=fs.readFileSync(path.join(root,"features/client/hooks/useClientSummary.ts"),"utf8");
if(!dashboard.includes('clientApi.invoices({status:"unpaid"})')){
 console.error("FAIL: unpaid invoices must be queried independently");
 failures++;
}
const fetcher=fs.readFileSync(path.join(root,"lib/api/client.ts"),"utf8");
if(!fetcher.includes('method === "GET" ? AbortSignal.timeout(12000) : undefined')){
 console.error("FAIL: read-only API calls must have a bounded loading window");
 failures++;
}
if(failures)process.exit(1);
console.log("PASS: customer copy and no-fabricated-account-state checks");
