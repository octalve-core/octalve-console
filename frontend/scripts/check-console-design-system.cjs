"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src/components/design-system");
const names=["ActionButton.tsx","ActionLink.tsx","Panel.tsx","SectionHeading.tsx","StatusBadge.tsx",
 "EmptyState.tsx","TextField.tsx","SelectField.tsx","TextAreaField.tsx","ConfirmDialog.tsx",
 "ResponsiveTable.tsx","action-styles.ts","index.ts"];
for(const file of names){
 const source=fs.readFileSync(path.join(root,file),"utf8");
 if(!source.trim())throw Error(file+" is empty");
 if(/(?:import|require)\s*(?:\(|[^;]*from\s*)["'][^"']+\.css["']/.test(source))throw Error(file+": CSS imports prohibited");
 if(/\bfetch\s*\(|\baxios\b|\blocalStorage\b/.test(source))throw Error(file+": UI primitives must not perform data/API operations");
}
function requires(file,tokens){
 const content=fs.readFileSync(path.join(root,file),"utf8");
 for(const token of tokens)if(!content.includes(token))throw Error(file+": missing "+token);
}
requires("action-styles.ts",["bg-console-primary","hover:bg-console-hover","focus-visible:ring-console-primary","h-12"]);
requires("TextField.tsx",["useId","htmlFor={controlId}","aria-invalid","aria-describedby","min-h-12"]);
requires("SelectField.tsx",["useId","htmlFor={controlId}","aria-invalid","options.map","min-h-12"]);
requires("TextAreaField.tsx",["useId","htmlFor={controlId}","aria-invalid","min-h-36"]);
requires("ConfirmDialog.tsx",["showModal()","onCancel","aria-labelledby","onConfirm"]);
requires("ResponsiveTable.tsx",["md:hidden","md:block",'scope="col"',"getRowKey(row)"]);
if(process.argv.includes("--built")){
 const dir=path.resolve(__dirname,"../.next/static");
 const css=[];
 function walk(folder){if(!fs.existsSync(folder))return;for(const e of fs.readdirSync(folder,{withFileTypes:true})){
  const name=path.join(folder,e.name);if(e.isDirectory())walk(name);else if(name.endsWith(".css"))css.push(name);
 }}
 walk(dir);if(!css.length)throw Error("No generated Tailwind stylesheets");
 const output=css.map(p=>fs.readFileSync(p,"utf8")).join("\n");
 for(const selector of [".bg-console-primary",".text-console-ink",".border-console-line",".min-h-36"])
  if(!output.includes(selector))throw Error("Missing built Tailwind class "+selector);
}
console.log("PASS: Console design-system source and emitted Tailwind utilities");
