"use strict";
/** Refuse presentation-only previews that bypass Console auth authority. */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../src");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const expect=(file,need)=>{
 const s=read(file);
 for(const x of need)if(!s.includes(x))throw Error(file+" missing "+x);
 return s;
};
const base="features/auth/";
const layout=expect(base+"components/AuthLayout.tsx",[
 "styles.art","styles.frame","AuthBrandLogo","https://cloud.octalve.com",
 "https://octalve.com","privacy-policy","terms-of-service","Back to home"
]);
const control=expect(base+"components/AuthFormControls.tsx",[
 "aria-invalid","aria-describedby","label htmlFor","aria-pressed","AuthSocialOptions",
 "disabled aria-label","AuthPasswordStrength","type=\"submit\""
]);
const css=expect(base+"components/AuthLayout.module.css",[
 ".art",".frame",".fieldShell",".action",".otpRow",
 '@media (max-width:750px)','url("/branding/octalve-auth-background.webp")'
]);
// source CSS only: arbitrary six digits must never verify a production account
const cases=[
 ["LoginPageClient.tsx",["await login({","getSafeNextPath()","router.replace","AuthSocialOptions","/forgot-password"]],
 ["SignupPageClient.tsx",["await signup({","referralConsent","acceptedTerms","AuthPasswordStrength","/login"]],
 ["ForgotPasswordPageClient.tsx",["authApi.requestPasswordReset(email.trim().toLowerCase())","If this email exists","/login"]],
 ["VerifyEmailPageClient.tsx",["authApi.confirmEmailVerification(token)","new URLSearchParams(window.location.hash.slice(1))","window.history.replaceState","Six-digit code entry is not enabled"]],
 ["ResetPasswordConfirmPageClient.tsx",["authApi.confirmPasswordReset(uid, token, values.password)","useParams()","safeDecode","AuthPasswordStrength","/login"]]
];
for(const [name,required] of cases){
 const source=expect(base+"views/"+name,required);
 if(!source.includes("AuthLayout"))throw Error(name+" lost shared form layout");
 if(/document\.querySelector|innerHTML\s*=|accept any six|Preview only/i.test(source))
  throw Error(name+" imports preview-only DOM manipulation");
}
if(layout.includes("AuthBrandPanel")||fs.existsSync(path.join(root,base+"components/AuthBrandPanel.tsx")))
 throw Error("Retired split-screen branded auth component returned");
if(css.includes(":global("))throw Error("Auth module must remain locally owned");
const retired=["auth-layout","auth-brand","auth-copy","auth-bars","auth-panel","auth-card"];
const global=read("app/globals.css");
for(const selector of retired){
 if(global.includes("."+selector))
  throw Error("Retired old auth global selector returned: "+selector);
}
const sourceFiles=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){
 const full=path.join(p,e.name);
 if(e.isDirectory())walk(full);else if(/\.(tsx?|jsx?)$/.test(full))sourceFiles.push(full);
}}
walk(root);
// Lexical class attributes are a conservative lower bound, not browser proof.
for(const name of retired){
 const pattern=new RegExp("className=[\\\"'][^\\\"']*\\b"+name+"\\b");
 for(const f of sourceFiles)if(pattern.test(fs.readFileSync(f,"utf8")))
  throw Error("Retired auth class still consumed in "+path.relative(root,f));
}
const baseline=JSON.parse(fs.readFileSync(path.resolve(root,"../audits/console-ui-baseline-2026-10-26.json"),"utf8"));
if(baseline.legacyCss.lines!==8460||baseline.legacyCss.gitBlobSha!=="af02677f8f5b1b06afd93be7f852a2071ce77f85")
 throw Error("Frozen CSS fingerprint no longer matches 42-line reviewed auth retirement");
for(const page of [
 "login/page.tsx","signup/page.tsx","forgot-password/page.tsx",
 "verify-email/page.tsx","reset-password/confirm/[uid]/[token]/page.tsx"
]){
 if(!fs.existsSync(path.join(root,"app",page)))throw Error("Missing real Next route "+page);
}
if(process.argv.includes("--built")){
 const files=[];
 function scan(p){if(!fs.existsSync(p))return;for(const e of fs.readdirSync(p,{withFileTypes:true})){
  const f=path.join(p,e.name);if(e.isDirectory())scan(f);else if(f.endsWith(".css"))files.push(f);
 }}
 scan(path.resolve(root,"../.next/static"));
 if(!files.length)throw Error("No compiled CSS assets");
 const output=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
 for(const token of ["octalve-auth-background.webp","--auth-brand:","#0874f7"])
  if(!output.includes(token))throw Error("Auth design token not emitted: "+token);
}
console.log("PASS: five separate real Django-linked auth pages share one responsive React UI; preview-only OTP and old auth CSS retired.");
console.log("PASS: WebP artwork path integrated (exact image integrity checked independently). PENDING: role-authenticated browser parity.");
