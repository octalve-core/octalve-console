"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const snapshot=JSON.parse(fs.readFileSync(path.join(root,"frontend/audits/console-ui-baseline-2026-10-26.json"),"utf8"));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=path.join(dir,e.name);
 return e.isDirectory()?walk(p):[path.relative(root,p).replaceAll(path.sep,"/")];
});}
const pages=walk(path.join(root,"frontend/src/app")).filter(p=>/^frontend\/src\/app\/(client|staff|admin)\/.*page\.tsx$/.test(p));
const missing=snapshot.routes.filter(p=>!pages.includes(p));
if(missing.length)throw Error("Previously published role routes missing: "+missing.join(", "));
const css=fs.readFileSync(path.join(root,snapshot.legacyCss.path));
const digest=crypto.createHash("sha1").update("blob "+css.length+"\0").update(css).digest("hex");
const changed=digest!==snapshot.legacyCss.gitBlobSha;
if(process.argv.includes("--check")&&changed)throw Error("Legacy CSS changed without audited baseline approval");
const currentCss=walk(path.join(root,"frontend/src")).filter(p=>p.endsWith(".css"));
const allowed=new Set([snapshot.legacyCss.path,...snapshot.otherCss]);
const unexpected=currentCss.filter(p=>!allowed.has(p));
if(process.argv.includes("--check")&&unexpected.length)throw Error("Unreviewed CSS files: "+unexpected.join(", "));
console.log(JSON.stringify({roleRoutes:pages.length,counts:Object.fromEntries(["client","staff","admin"].map(r=>[r,pages.filter(p=>p.startsWith("frontend/src/app/"+r+"/")).length])),newRoutes:pages.filter(p=>!snapshot.routes.includes(p)),legacyCss:{bytes:css.length,lines:css.toString("utf8").split("\n").length,unchanged:!changed},cssFiles:currentCss},null,2));
