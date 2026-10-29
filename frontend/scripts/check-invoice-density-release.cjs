"use strict";
/** Release gate: actual Tailwind retirement from reachable pages.
 * This only proves source ownership. Owner browser review is separately required.
 */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),src=path.join(root,"src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const scan=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>
 e.isDirectory()?scan(path.join(dir,e.name)):[path.join(dir,e.name)]);
const css=read("src/app/globals.css"),lines=css.split("\n").length;
const paths=scan(src).filter(p=>/\.(?:ts|tsx|js|jsx)$/.test(p));
const sources=new Map(paths.map(p=>[path.relative(src,p).split(path.sep).join("/"),
 fs.readFileSync(p,"utf8")]));
const inventory=JSON.parse(read("audits/legacy-global-selector-inventory-2026-10-29.json"));
if(inventory.schemaVersion!==1||inventory.sourceLineCount!==8460||inventory.selectorCount!==500)
 throw Error("Historical selector snapshot changed without review");
const historical=new Set(inventory.distinctiveSelectors);
function classes(body) {
 const used=new Set();
 for(const m of body.matchAll(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*\x60([^\x60]*)\x60)/g))
  for(const token of (m[1]??m[2]??m[3]??"").matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g))
   if(historical.has(token[0]))used.add(token[0]);
 return [...used].sort();
}
const uses=new Map([...sources].map(([f,s])=>[f,classes(s)]));
function resolve(file,spec) {
 const base=spec.startsWith("@/")?spec.slice(2):spec.startsWith(".")?
  path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)):null;
 if(!base)return null;
 return [base,base+".tsx",base+".ts",base+".jsx",base+".js",
  base+"/index.tsx",base+"/index.ts"].find(x=>sources.has(x))??null;
}
const graph=new Map();
for(const [file,body] of sources){
 const deps=new Set();
 for(const m of body.matchAll(/(?:import|export)\s+(?:[^\n'"]+\s+from\s*)?["']([^"']+)["']/g)){
  const dep=resolve(file,m[1]);if(dep)deps.add(dep);
 }
 for(const m of body.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)){
  const dep=resolve(file,m[1]);if(dep)deps.add(dep);
 }
 graph.set(file,[...deps]);
}
const routes=[...sources.keys()].filter(f=>f.startsWith("app/")&&f.endsWith("/page.tsx"));
const special=[...sources.keys()].filter(f=>f.startsWith("app/")&&
 /(?:^|\/)(?:layout|not-found|error|global-error|loading)\.tsx$/.test(f));
const active=new Set(),queue=[...routes,...special];
while(queue.length){
 const f=queue.shift();if(!f||active.has(f))continue;
 active.add(f);
 for(const dep of graph.get(f)??[])if(!active.has(dep))queue.push(dep);
}
const live=[...active].flatMap(file=>(uses.get(file)??[]).map(name=>({file,name})));
const dormant=[...uses].filter(([file,classes])=>classes.length&&!active.has(file))
 .map(([file,classes])=>({file,classes}));
const otherCss=scan(src).filter(p=>p.endsWith(".css")&&
 p!==path.join(src,"app/globals.css")&&!p.endsWith(".module.css"));
const oldRules=[...css.replace(/\/\*[\s\S]*?\*\//g,"").matchAll(/([^{}]+)\{/g)]
 .filter(x=>!x[1].trim().startsWith("@"))
 .flatMap(x=>[...x[1].matchAll(/(?<!\\)\.([A-Za-z_][A-Za-z0-9_-]*)/g)]
 .map(y=>y[1]));
const remaining=[...new Set(oldRules.filter(name=>historical.has(name)))].sort();
const weights=[...css.matchAll(/font-weight\s*:\s*(?:[6-9]\d\d|bold|bolder)\b/g)].length;
const bold=[...sources].filter(([,s])=>/(?:^|[^\w-])font-(?:bold|semibold|extrabold|black)(?![\w-])/.test(s)).map(([f])=>f);
const blockers=[];
if(lines>300)blockers.push("globals.css over 300 lines ("+lines+")");
if(live.length)blockers.push("Route-reachable unmigrated legacy classes: "+live.length);
if(remaining.length)blockers.push("Retired legacy global rules still present: "+remaining.length);
if(otherCss.length)blockers.push("Unreviewed additional unscoped global stylesheets");
if(weights||bold.length)blockers.push("Weights above medium remain");
if(routes.length!==135)blockers.push("Route count changed: "+routes.length);
if(!css.startsWith("@tailwind base;\n@tailwind components;\n@tailwind utilities;"))
 blockers.push("Canonical Tailwind directives missing");
const report={mode:process.argv.includes("--enforce")?"enforce":"inventory",
 cssLines:lines,limit:300,routeCount:routes.length,activeModules:active.size,
 liveLegacyClassConsumers:live,dormantLegacyFileCount:dormant.length,dormantSamples:dormant.slice(0,8),
 remainingHistoricalGlobalRules:remaining.length,unscopedCssCount:otherCss.length,
 highFontWeights:weights,boldSourceFiles:bold.length,sourceQualified:blockers.length===0,
 blockers,browserAcceptance:"135 routes x 6 viewports still require actual role-authenticated screenshots and owner review"};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes("--enforce")&&blockers.length)process.exitCode=1;
