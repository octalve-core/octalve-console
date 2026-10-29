"use strict";
/**
 * Invoice-density migration status and final source gate.
 * Default: non-certifying inventory. --enforce: source-level release blocker.
 * Real authenticated browser acceptance is a separate required gate.
 */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),src=path.join(root,"src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=path.join(dir,e.name);return e.isDirectory()?files(p):[p];
});}
const css=read("src/app/globals.css");
const cssLines=css.split("\n").length;
const sourceFiles=files(src).filter(p=>/\.(ts|tsx|jsx|js)$/.test(p));
const boldPattern=/(?<![\w-])font-(?:semibold|bold|extrabold|black)(?![\w-])/g;
const utilitySources=sourceFiles.map(p=>({
 file:path.relative(root,p).replaceAll(path.sep,"/"),
 count:[...fs.readFileSync(p,"utf8").matchAll(boldPattern)].length
})).filter(x=>x.count>0);
const cssFiles=files(src).filter(p=>p.endsWith(".css"));
const unexpectedGlobal=cssFiles.filter(p=>p!==path.join(src,"app/globals.css")&&!p.endsWith(".module.css"));
const highWeight=[...css.matchAll(/font-weight\s*:\s*(?:6[0-9][0-9]|7[0-9][0-9]|8[0-9][0-9]|9[0-9][0-9]|bold|bolder)\b/g)].length;
// The original selectors remain in a separate, reviewable ownership inventory.
// Removing only globals.css while leaving its old JSX classnames is not retirement.
const inventory=JSON.parse(read("audits/legacy-global-selector-inventory-2026-10-29.json"));
if(inventory.schemaVersion!==1||inventory.sourceLineCount!==8460||inventory.selectorCount!==500)
 throw Error("Historical legacy selector baseline changed without review");
const legacyNames=new Set(inventory.distinctiveSelectors);
const directLegacyConsumers=[];
for(const file of sourceFiles){
 const content=fs.readFileSync(file,"utf8");
 const used=new Set();
 for(const match of content.matchAll(/\\bclassName\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*\x60([^\x60]*)\x60)/g)){
  for(const word of (match[1]??match[2]??match[3]??"").matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)){
   if(legacyNames.has(word[0]))used.add(word[0]);
  }
 }
 if(used.size)directLegacyConsumers.push({
  file:path.relative(root,file).replaceAll(path.sep,"/"),names:[...used].sort()
 });
}
const oldRules=[...css.replace(/\\/\\*[\\s\\S]*?\\*\\//g,"").matchAll(/([^{}]+)\\{/g)]
 .filter(x=>!x[1].trim().startsWith("@"))
 .flatMap(x=>[...x[1].matchAll(/(?<!\\\\)\\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(y=>y[1]));
const remainingDistinctive=[...new Set(oldRules.filter(x=>legacyNames.has(x)))].sort();
const routes=files(path.join(src,"app")).filter(p=>p.endsWith("/page.tsx")).length;
const problems=[];
if(cssLines>300)problems.push("globals.css exceeds 300 lines ("+cssLines+")");
if(directLegacyConsumers.length)problems.push("legacy className consumers still depend on old CSS ("+directLegacyConsumers.length+" files)");
if(remainingDistinctive.length)problems.push("historical component selectors remain in globals.css ("+remainingDistinctive.length+")");

if(utilitySources.length)problems.push("bold utility consumers remain ("+utilitySources.length+" files)");
if(highWeight)problems.push("font weights above 500 remain in global CSS ("+highWeight+")");
if(unexpectedGlobal.length)problems.push("unreviewed extra global CSS files exist");
if(routes!==135)problems.push("route count changed: "+routes);
if(!css.startsWith("@tailwind base;\n@tailwind components;\n@tailwind utilities;"))
 problems.push("Tailwind v3 directives missing");
const report={
 target:"Invoice-density and genuine CSS retirement",mode:process.argv.includes("--enforce")?"enforce":"inventory",
 css:{lines:cssLines,maximum:300,highWeightDeclarations:highWeight,unexpectedGlobal:unexpectedGlobal.map(p=>path.relative(root,p))},
 source:{files:sourceFiles.length,filesWithBoldUtilities:utilitySources.length,remainingBoldUtilities:utilitySources.reduce((n,x)=>n+x.count,0),samples:utilitySources.slice(0,12),remainingBoldFilePaths:utilitySources.map(x=>x.file)},
 legacy:{directConsumerFiles:directLegacyConsumers.length,directConsumerSamples:directLegacyConsumers.slice(0,18),remainingDistinctiveSelectors:remainingDistinctive.length,selectorSamples:remainingDistinctive.slice(0,18),limitation:"Dynamic class generation and visual parity require authenticated browser review"},
 routes,readyForSourceQualification:problems.length===0,blockers:problems,
 note:"Source pass is not an authenticated browser pass. Never relocate/minify legacy CSS to pass this gate."
};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes("--enforce")&&problems.length)process.exitCode=1;
