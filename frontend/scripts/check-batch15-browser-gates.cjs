"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {verifyAttestedEvidence}=require("./browser-evidence-attestation.cjs");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"cloud-browser-gate-"));
try{
 const root=path.join(temp,"shots");fs.mkdirSync(root);
 const pixel=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YZ6rz8AAAAASUVORK5CYII=","base64");
 fs.writeFileSync(path.join(root,"one.png"),pixel);
 const sha=crypto.createHash("sha256").update(pixel).digest("hex");
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
 const keyFile=path.join(temp,"operator.pub");
 fs.writeFileSync(keyFile,publicKey.export({format:"pem",type:"spki"}));
 const fingerprint=crypto.createHash("sha256").update(publicKey.export({format:"der",type:"spki"})).digest("hex");
 const releaseSha="a".repeat(40),baseUrl="https://console.cloud.octalve.com";
 const expected=[{route:"/client/services/[id]",role:"client",fixtureIdsNeeded:["id"]}];
 const vp=[320,1440],checks=["keyboard_focus","no_horizontal_overflow"];
 const manifest={schemaVersion:2,releaseSha,baseUrl,reviewer:"isolated-ci-reviewer",
  runId:"synthetic-integrity-only",
  routes:[{route:expected[0].route,role:"client",status:"passed",
    resolvedPath:"/client/services/123",fixtureVerified:true,evidenceId:"CI-not-real-browser",
    viewports:vp.map(width=>({width,status:"passed",checks:{
      keyboard_focus:true,no_horizontal_overflow:true
    },screenshot:{path:"one.png",sha256:sha}}))}]};
 const evidenceFile=path.join(temp,"evidence.json");
 function writeSigned(value){
  const payload=Buffer.from(JSON.stringify(value));
  fs.writeFileSync(evidenceFile,JSON.stringify({
   payload_base64:payload.toString("base64"),
   signature_base64:crypto.sign(null,payload,privateKey).toString("base64")
  }));
 }
 const opts={evidenceFile,evidenceRoot:root,publicKeyFile:keyFile,keySha256:fingerprint,
  releaseSha,expectedRoutes:expected,viewports:vp,checks,baseUrl};
 writeSigned(manifest);
 const ok=verifyAttestedEvidence(opts);
 assert.equal(ok.artifacts,2);
 const fail=()=>assert.throws(()=>verifyAttestedEvidence(opts),/REFUSED|ENOENT/);
 // A signature, successful CI or screenshot metadata alone must never suffice.
 fs.writeFileSync(evidenceFile,JSON.stringify({
  payload_base64:Buffer.from(JSON.stringify(manifest)).toString("base64"),
  signature_base64:Buffer.alloc(64).toString("base64")
 }));
 fail();
 writeSigned(manifest);
 assert.throws(()=>verifyAttestedEvidence({...opts,keySha256:"0".repeat(64)}),/REFUSED/);
 const other={...manifest,routes:[{...manifest.routes[0],role:"admin"}]};
 writeSigned(other);fail();
 const tamper={...manifest,routes:[{...manifest.routes[0],viewports:[{
  ...manifest.routes[0].viewports[0],screenshot:{path:"../one.png",sha256:sha}
 },manifest.routes[0].viewports[1]]}]};
 writeSigned(tamper);fail();
 writeSigned(manifest);fs.writeFileSync(path.join(root,"one.png"),Buffer.from("invalid"));
 fail();
 console.log("PASS: Batch 15 positive integrity fixture, tampering, wrong role, traversal and damaged PNG all gated.");
 console.log("NO AUTHENTICATED BROWSER QUALIFICATION IS CLAIMED BY THIS CI TEST.");
}finally{fs.rmSync(temp,{recursive:true,force:true});}