"use client";
import {useEffect,useState} from "react";
import {readConnectionOverview,type DraftConnection} from "./connection-readback";
export function useConnectionOverview(){
 const [state,setState]=useState<{
  status:"loading"|"ready"|"unavailable";
  connections:DraftConnection[];supported:ReadonlySet<string>;truncated:boolean;
 }>({status:"loading",connections:[],supported:new Set(),truncated:false});
 useEffect(()=>{
  let alive=true;
  void readConnectionOverview().then(result=>{
   if(alive)setState({...result,status:"ready"});
  }).catch(()=>{
   if(alive)setState({status:"unavailable",connections:[],supported:new Set(),truncated:false});
  });
  return ()=>{alive=false;};
 },[]);
 return state;
}
