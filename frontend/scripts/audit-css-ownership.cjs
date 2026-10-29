"use strict";
/**
 * Conservative ownership inventory, NOT an automated deletion oracle.
 * Parse CSS via PostCSS and scan JS/TS source for POSSIBLE class references.
 * Zero source matches alone never qualify a selector for deletion.
 */
const fs=require("node:fs"),path=require("node:path"),postcss=require("postcss");
const root=path.resolve(__dirname,".."),src=path.join(root,"src");
const cssPath=path.join(src,"app/globals.css");
const body=fs.readFileSync(cssPath,"utf8"),rootCss=postcss.parse(body,{from:cssPath});
const baseline=JSON.parse(fs.readFileSync(path.join(root,"audits/console-ui-baseline-2026-10-26.json"),"utf8"));
function walk(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p];
 });
}
const sourceFiles=walk(src).filter(p=>/\.(?:tsx?|jsx?|mdx)$/.test(p));
const sourceTexts=sourceFiles.map(p=>({path:path.relative(root,p).split(path.sep).join("/"),body:fs.readFileSync(p,"utf8")}));
const otherCss=walk(src).filter(p=>p.endsWith(".css")&&p!==cssPath).map(p=>path.relative(root,p).split(path.sep).join("/"));
const unexpectedGlobal=otherCss.filter(p=>!p.endsWith(".module.css"));
const classes=new Map();let rules=0,mediaRules=0,complexRules=0;
rootCss.walkRules(rule=>{
 rules++;
 let parent=rule.parent;
 while(parent&&parent.type!=="root"){
  if(parent.type==="atrule"&&/media|supports|container/.test(parent.name)){mediaRules++;break}
  parent=parent.parent;
 }
 const selector=rule.selector;
 const names=[...selector.matchAll(/(?<!\\)\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(x=>x[1]);
 const complex=names.length>1||selector.includes(",")||/[:#\[]/.test(selector);
 if(complex)complexRules++;
 for(const name of new Set(names)){
  const item=classes.get(name)||{name,rules:0,sourceConsumers:[],examples:[],complex:false};
  item.rules++;item.complex||=complex;
  if(item.examples.length<2)item.examples.push(selector.slice(0,140));
  classes.set(name,item);
 }
});
function escaped(name){return name.replace(/[-/\\^$*+?.()|[\]{}]/g,"\\$&")}
for(const x of classes.values()){
 const re=new RegExp("(^|[^A-Za-z0-9_-])"+escaped(x.name)+"(?![A-Za-z0-9_-])");
 x.sourceConsumers=sourceTexts.filter(y=>re.test(y.body)).map(y=>y.path);
}
const sorted=[...classes.values()].sort((a,b)=>b.sourceConsumers.length-a.sourceConsumers.length||b.rules-a.rules);
const zero=sorted.filter(x=>!x.sourceConsumers.length);
const tracked=["grid","button","card","table","badge","tab","tabs","input","select","textarea","page-container","stat-card","stat-label","stat-value","stat-icon"];
const collisions=tracked.map(name=>sorted.find(x=>x.name===name)).filter(Boolean);
const report={schemaVersion:1,warning:"Source reference inventory is conservative. A zero-match result does NOT authorize deleting CSS; manual dynamic/rendered-state review and role-authenticated browser parity are mandatory.",
 css:{path:"src/app/globals.css",lines:body.split("\n").length,bytes:Buffer.byteLength(body),rules,mediaRules,complexRules,distinctClasses:classes.size},
 source:{files:sourceFiles.length,tsx:sourceFiles.filter(p=>p.endsWith(".tsx")).length},
 otherCss,unexpectedGlobal,
 collisions,
 candidateReviewOnly:zero.slice(0,80).map(x=>({name:x.name,rules:x.rules,complex:x.complex,examples:x.examples})),
 consumers:sorted.map(x=>({name:x.name,rules:x.rules,sourceConsumers:x.sourceConsumers,complex:x.complex,examples:x.examples}))
};
if(process.argv.includes("--check")){
 if(unexpectedGlobal.length)throw Error("Unreviewed global CSS outside root: "+unexpectedGlobal.join(", "));
 if(report.css.lines>300||report.css.distinctClasses>12)throw Error("Legacy global styling was not fully retired");
 if(sourceFiles.length<400)throw Error("CSS ownership scan lost source files");
}
const i=process.argv.indexOf("--json");
if(i>=0){
 const dest=process.argv[i+1];if(!dest)throw Error("Provide path after --json");
 fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});
 fs.writeFileSync(path.resolve(dest),JSON.stringify(report,null,2)+"\n");
}
console.log("Console CSS ownership (review-only): "+JSON.stringify({
 css:report.css,source:report.source,otherCss,candidateReviewOnly:zero.length,
 collisionAudit:collisions.map(x=>({name:x.name,rules:x.rules,consumerFiles:x.sourceConsumers.length,sample:x.sourceConsumers.slice(0,2)}))
},null,2));
