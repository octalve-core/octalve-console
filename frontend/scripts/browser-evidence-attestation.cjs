"use strict";
/** Structural and signed-evidence verifier. Real browser observations and visual
 *  approval remain separate human/operator acceptance steps.
 *  This module never opens a web session or accesses application credentials.
 */
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const MAX_ENVELOPE=8*1024*1024;
const MAX_IMAGE=8*1024*1024;
const pngHeader=Buffer.from("89504e470d0a1a0a","hex");
function requireValid(condition,message){if(!condition)throw Error("Browser evidence REFUSED: "+message);}
function hexSha(data){return crypto.createHash("sha256").update(data).digest("hex");}
function exactPattern(route){
 const parts=route.split("/").map(part=>{
   if(/^\[\[\.\.\.[^\]]+\]\]$/.test(part))return ".*";
   if(/^\[\.\.\.[^\]]+\]$/.test(part))return ".+";
   if(/^\[[^\]]+\]$/.test(part))return "[^/]+";
   return part.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
 });
 return new RegExp("^"+parts.join("/")+"$");
}
function checkedScreenshot(root,screenshot){
 requireValid(screenshot&&typeof screenshot==="object","Screenshot metadata absent");
 const relative=screenshot.path,hash=screenshot.sha256;
 requireValid(typeof relative==="string"&&relative.length>4&&relative.length<320 &&
   relative.endsWith(".png")&&!relative.includes("\\")&&!relative.startsWith("/") &&
   relative.split("/").every(part=>part!==""&&part!=="."&&part!==".."),
   "Unsafe screenshot artifact path");
 requireValid(typeof hash==="string"&&/^[a-f0-9]{64}$/.test(hash),"Screenshot digest missing");
 const joined=path.join(root,relative);
 const stat=fs.lstatSync(joined);
 requireValid(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>=pngHeader.length &&
   stat.size<=MAX_IMAGE,"Screenshot is missing, symbolic or too large");
 const real=fs.realpathSync(joined);
 requireValid(real.startsWith(root+path.sep),"Screenshot path escaped evidence directory");
 const bytes=fs.readFileSync(real);
 requireValid(bytes.subarray(0,pngHeader.length).equals(pngHeader),"Screenshot is not PNG");
 requireValid(hexSha(bytes)===hash,"Screenshot digest does not match");
}
function verifyAttestedEvidence({evidenceFile,evidenceRoot,publicKeyFile,
  keySha256,releaseSha,expectedRoutes,viewports,checks,baseUrl}){
 requireValid(/^[a-f0-9]{40}$/.test(releaseSha??""),"Exact release SHA required");
 requireValid(/^[a-f0-9]{64}$/.test(keySha256??""),"Trusted signer fingerprint required");
 requireValid(Array.isArray(expectedRoutes)&&expectedRoutes.length>0,"Route plan missing");
 const key=crypto.createPublicKey(fs.readFileSync(publicKeyFile));
 requireValid(key.asymmetricKeyType==="ed25519","Only Ed25519 operator signers allowed");
 const keyDigest=hexSha(key.export({format:"der",type:"spki"}));
 requireValid(keyDigest===keySha256,"Signer public key is not the approved fingerprint");
 const contents=fs.readFileSync(evidenceFile);
 requireValid(contents.length>0&&contents.length<=MAX_ENVELOPE,"Envelope too large");
 const envelope=JSON.parse(contents.toString("utf8"));
 requireValid(envelope&&typeof envelope.payload_base64==="string"&&
   typeof envelope.signature_base64==="string"&&
   /^[A-Za-z0-9+/]+={0,2}$/.test(envelope.payload_base64)&&
   /^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature_base64),"Signed envelope invalid");
 const payload=Buffer.from(envelope.payload_base64,"base64");
 const signature=Buffer.from(envelope.signature_base64,"base64");
 requireValid(signature.length===64&&crypto.verify(null,payload,key,signature),
   "Signature invalid");
 const manifest=JSON.parse(payload.toString("utf8"));
 requireValid(manifest.schemaVersion===2&&manifest.releaseSha===releaseSha&&
   manifest.baseUrl===baseUrl,"Evidence bound to another release or origin");
 requireValid(typeof manifest.runId==="string"&&manifest.runId.length>=10 &&
   manifest.runId.length<=160&&typeof manifest.reviewer==="string"&&
   manifest.reviewer.length>=3&&manifest.reviewer.length<=160,
   "Independent reviewer metadata missing");
 requireValid(Array.isArray(manifest.routes)&&manifest.routes.length===expectedRoutes.length,
   "Route count does not match inventory");
 const actualRoutes=new Map();
 for(const result of manifest.routes){
   requireValid(result&&typeof result.route==="string"&&!actualRoutes.has(result.route),
     "Duplicate or malformed route result");
   actualRoutes.set(result.route,result);
 }
 const root=fs.realpathSync(evidenceRoot);
 requireValid(fs.statSync(root).isDirectory(),"Evidence root must be a directory");
 let artifacts=0;
 for(const expected of expectedRoutes){
   const actual=actualRoutes.get(expected.route);
   requireValid(actual&&actual.role===expected.role&&actual.status==="passed",
     "Missing or unauthorized route "+expected.route);
   requireValid(typeof actual.resolvedPath==="string"&&exactPattern(expected.route).test(actual.resolvedPath),
     "Wrong fixture path for "+expected.route);
   requireValid(typeof actual.evidenceId==="string"&&actual.evidenceId.length>=10 &&
     actual.evidenceId.length<=160,"No independent test evidence reference");
   if(expected.fixtureIdsNeeded.length)requireValid(actual.fixtureVerified===true,
     "Dynamic fixture was not independently verified");
   requireValid(Array.isArray(actual.viewports)&&actual.viewports.length===viewports.length,
     "Viewport coverage incomplete");
   const seen=new Set();
   for(const item of actual.viewports){
     requireValid(item&&viewports.includes(item.width)&&!seen.has(item.width),
       "Duplicate or unrecognized viewport");
     seen.add(item.width);
     requireValid(item.status==="passed"&&item.checks&&
       checks.every(check=>item.checks[check]===true),
       "Viewport checks missing or failing");
     checkedScreenshot(root,item.screenshot);
     artifacts++;
   }
 }
 requireValid(artifacts===expectedRoutes.length*viewports.length,
   "Missing screenshots");
 return {routes:expectedRoutes.length,viewports:viewports.length,artifacts,
   releaseSha,signerSha256:keyDigest};
}
module.exports={verifyAttestedEvidence};
