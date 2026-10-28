"use strict";
/* Approved background image is a real file, never a preview-only data URL.
   The expected Git blob is verified independently against the uploaded artifact. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const frontend=path.resolve(__dirname,"..");
const asset=path.join(frontend,"public/branding/octalve-auth-background.webp");
const style=fs.readFileSync(path.join(frontend,"src/features/auth/components/AuthLayout.module.css"),"utf8");
if(!fs.existsSync(asset))throw Error("User-approved scenic background is missing from public/branding");
const bytes=fs.readFileSync(asset);
if(bytes.length!==273266)throw Error("Approved scenic image changed or is not optimized WebP");
if(bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")
 throw Error("Scenic art is not a valid RIFF/WebP container");
if(bytes.readUInt32LE(4)!==bytes.length-8)throw Error("Invalid WebP container length");
const sha=crypto.createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
if(sha!=="c9e02cc553c6946184057acd7e4900397c73bcf8")
 throw Error("Uploaded image differs from the approved source artifact");
if(!style.includes('url("/branding/octalve-auth-background.webp")'))
 throw Error("Auth stylesheet no longer references the approved static image");
if(style.includes("data:image/"))throw Error("Unreviewed base64 image bloating auth stylesheet");
const logo=path.join(frontend,"public/branding/octalve-cloud-logo.png");
if(!fs.existsSync(logo))throw Error("Dashboard/auth Cloud logo missing");
const logoSrc=fs.readFileSync(path.join(frontend,"src/components/branding/CloudBrandLogo.tsx"),"utf8");
if(!logoSrc.includes('"/branding/octalve-cloud-logo.png"'))throw Error("Auth logo diverged from dashboard");
console.log("PASS: approved 273,266-byte WebP, exact Git blob SHA, valid WebP header, single scoped CSS reference and shared logo.");
