"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src/app");
const viewports=[320,360,390,768,1024,1440];
const requiredChecks=["no_horizontal_overflow","navigation","keyboard_focus","responsive_layout","data_truthfulness"];
function walk(dir,relative=""){
 if(!fs.existsSync(dir))return [];
 const paths=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const segment=relative?relative+"/"+item.name:item.name;
  if(item.isDirectory())paths.push(...walk(path.join(dir,item.name),segment));
  else if(item.name==="page.tsx")paths.push(segment);
 }
 return paths;
}
const routes=walk(root).sort().map(file=>{
 const segments=file.split("/").slice(0,-1);
 const url="/"+segments.join("/");
 const role=segments[0]==="admin"?"admin":segments[0]==="staff"?"staff":
  segments[0]==="client"?"client":"public";
 const fixtures=[...url.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
 return {route:url==="/"?"/":url,source:"src/app/"+file,role,
  fixtureIdsNeeded:fixtures,breakpoints:viewports,checks:requiredChecks,
  status:"pending",testedAt:null,evidence:null};
});
const counts=Object.fromEntries(["admin","client","staff","public"].map(role=>[role,routes.filter(x=>x.role===role).length]));
if(routes.length!==134||counts.admin!==84||counts.client!==33||counts.staff!==10||counts.public!==7)
 throw Error("Route coverage inventory has changed; review all missing/added pages before qualification");
const plan={schemaVersion:1,release:"Batch 8 browser acceptance",
 baseUrl:"https://console.cloud.octalve.com",viewports,roles:counts,
 requirement:"Every route requires six viewports, role-correct authenticated interaction and recorded evidence. Do not perform real payments, communications or provisioning.",
 routes};
if(process.argv.includes("--plan")){
 const at=process.argv.indexOf("--plan"),output=process.argv[at+1];
 if(!output)throw Error("Supply output path after --plan");
 const full=path.resolve(output);
 fs.mkdirSync(path.dirname(full),{recursive:true});
 fs.writeFileSync(full,JSON.stringify(plan,null,2)+"\n");
}
if(process.argv.includes("--verify")){
 const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
 const evidenceFile=arg("--verify"),evidenceRoot=arg("--evidence-root");
 const publicKeyFile=arg("--public-key"),keySha256=arg("--key-sha256"),releaseSha=arg("--release-sha");
 if(!evidenceFile||!evidenceRoot||!publicKeyFile||!keySha256||!releaseSha)
  throw Error("Signed evidence, artifact root, trusted Ed25519 key fingerprint and exact commit SHA are mandatory");
 const {verifyAttestedEvidence}=require("./browser-evidence-attestation.cjs");
 const result=verifyAttestedEvidence({
  evidenceFile,evidenceRoot,publicKeyFile,keySha256,releaseSha,
  expectedRoutes:routes,viewports,checks:requiredChecks,baseUrl:plan.baseUrl,
 });
 console.log("PASS: signed evidence structure and "+result.artifacts+" PNG digests match "+result.releaseSha);
 console.log("PENDING: reviewer must separately attest genuine role authentication, visual parity and deployed runtime.");

}else{
 console.log("PENDING: Batch 8 browser parity plan covers "+routes.length+" routes / "+(routes.length*viewports.length)+" viewport cases; verified results require real authenticated browser evidence.");
}
