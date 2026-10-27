"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const css=fs.readFileSync(path.join(root,"app/globals.css"),"utf8");
function walk(dir){
 if(!fs.existsSync(dir))return [];
 const files=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...walk(p));
  else if(/\.(?:tsx?|jsx?)$/.test(entry.name))files.push(p);
 }return files;
}
const rel=p=>path.relative(root,p).split(path.sep).join("/");
const sources=new Map(walk(root).map(p=>[rel(p),fs.readFileSync(p,"utf8")]));
const selectors=new Set();
const stripped=css.replace(/\/\*[\s\S]*?\*\//g,"");
for(const rule of stripped.matchAll(/([^{}]+)\{/g)){
 if(/^\s*@/.test(rule[1]))continue;
 for(const m of rule[1].matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g))selectors.add(m[1]);
}
function usage(body){
 const result=new Set();
 const attr=/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*\x60([^\x60]*)\x60)/g;
 for(const m of body.matchAll(attr)){
  for(const token of (m[1]??m[2]??m[3]??"").matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g))
   if(selectors.has(token[0]))result.add(token[0]);
 }
 // Only direct JSX class attributes are counted as confirmed tokens.
 // Conditional cn()/clsx() and template-driven names require browser review.
 return [...result].sort();
}
const uses=new Map([...sources].map(([file,body])=>[file,usage(body)]));
function resolve(file,spec){
 const base=spec.startsWith("@/")?spec.slice(2):spec.startsWith(".")?
  path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)):null;
 if(!base)return null;
 return [base,base+".tsx",base+".ts",base+".jsx",base+".js",base+"/index.tsx",base+"/index.ts"]
  .find(p=>sources.has(p))??null;
}
const graph=new Map();
for(const [file,body] of sources){
 const dest=new Set();
 for(const m of body.matchAll(/(?:import|export)\s+(?:[^\n'"]+\s+from\s*)?["']([^"']+)["']/g)){
  const t=resolve(file,m[1]);if(t)dest.add(t);
 }
 for(const m of body.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)){
  const t=resolve(file,m[1]);if(t)dest.add(t);
 }
 graph.set(file,[...dest]);
}
const routeFiles=[...sources.keys()].filter(p=>p.startsWith("app/")&&p.endsWith("/page.tsx")).sort();
function role(file){return file.startsWith("app/admin/")?"admin":file.startsWith("app/client/")?"client":file.startsWith("app/staff/")?"staff":"public/auth";}
function traverse(file){
 const visited=new Set(),queue=[file],result=new Set();
 while(queue.length){
  const item=queue.shift();if(!item||visited.has(item))continue;
  visited.add(item);
  for(const cls of uses.get(item)??[])result.add(cls);
  for(const next of graph.get(item)??[])if(!visited.has(next))queue.push(next);
 }
 return {modules:[...visited],classes:[...result].sort()};
}
const routes=routeFiles.map(file=>({file,route:"/"+file.slice(4,-9),role:role(file),...traverse(file)}));
const consumers=[...uses].filter(([,names])=>names.length).map(([file,names])=>({file,classes:names}));
const group={};
for(const key of ["admin","client","staff","public/auth"]){
 const x=routes.filter(r=>r.role===key);group[key]={routes:x.length,withLegacy:x.filter(r=>r.classes.length>0).length};
}
const usageCount=new Map();
for(const x of consumers)for(const cls of x.classes){
 const old=usageCount.get(cls)||{className:cls,files:[],routes:0};
 old.files.push(x.file);usageCount.set(cls,old);
}
for(const x of routes)for(const cls of x.classes)usageCount.get(cls).routes++;
const top=[...usageCount.values()].sort((a,b)=>b.routes-a.routes||b.files.length-a.files.length)
 .slice(0,60).map(x=>({className:x.className,routeConsumers:x.routes,fileConsumers:x.files.length,sampleFile:x.files[0]}));
const report={schemaVersion:1,stylesheet:{path:"src/app/globals.css",lines:css.split("\n").length,
 bytes:Buffer.byteLength(css,"utf8"),classSelectors:selectors.size},
 totals:{routePages:routes.length,sourceFiles:sources.size,directClassConsumers:consumers.length,
 routesWithDirectLegacyClassTokens:routes.filter(x=>x.classes.length>0).length},
 group,top,consumers,routeDependencies:routes.map(x=>({file:x.file,route:x.route,
 role:x.role,legacyClasses:x.classes,sourceModuleCount:x.modules.length,
 ownerFiles:x.modules.filter(p=>(uses.get(p)||[]).length>0)}))};
const flag=process.argv.indexOf("--json");
if(flag>=0){
 const dest=process.argv[flag+1];if(!dest)throw Error("Missing --json filename");
 fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});
 fs.writeFileSync(path.resolve(dest),JSON.stringify(report,null,2)+"\n");
}
console.log("Batch 8 CSS audit: "+JSON.stringify({stylesheet:report.stylesheet,totals:report.totals,group,top:top.slice(0,15)},null,2));
if(process.argv.includes("--require-retired")&&(consumers.length||css.split("\n").length>120)){
 console.error("BLOCK: Legacy stylesheet remains too large or direct class consumers exist. Browser parity is also required.");
 process.exitCode=1;
}
