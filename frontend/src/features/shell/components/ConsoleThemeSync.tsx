"use client";
import {useEffect} from "react";
import {api} from "@/lib/api/client";
/** Applies only validated allowlisted server theme colours to Console semantic tokens. */
const allowedPrimary=new Set(["#0064E0","#0052B8","#135FC7"]);
const allowedCanvas=new Set(["#F8FAFC","#F6F8FB","#FFFFFF","#F2F7FC"]);
export function ConsoleThemeSync(){
 useEffect(()=>{
  let active=true;
  api.get<{primary_color:string;canvas_color:string;density:string}>("/settings/console-theme/")
   .then(theme=>{
    if(!active)return;
    if(allowedPrimary.has(theme.primary_color))
     document.documentElement.style.setProperty("--console-primary",theme.primary_color);
    if(allowedCanvas.has(theme.canvas_color))
     document.documentElement.style.setProperty("--console-canvas",theme.canvas_color);
    if(theme.density==="compact")
     document.documentElement.style.setProperty("--console-panel-padding","0.75rem");
    else if(theme.density==="comfortable")
     document.documentElement.style.setProperty("--console-panel-padding","1rem");
   }).catch(()=>{/* Retain compiled brand-safe defaults if unavailable. */});
  return()=>{active=false;};
 },[]);
 return null;
}
