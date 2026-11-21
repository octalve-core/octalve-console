"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {ShieldCheck} from "lucide-react";

import {
  clientApi,
  type GooglePayReviewConfig,
} from "@/lib/api/endpoints";

type GooglePayEnvironment = "TEST"|"PRODUCTION";
type GooglePaymentMethod = Record<string, unknown>;
type GooglePaymentRequest = {
  apiVersion:2;
  apiVersionMinor:0;
  allowedPaymentMethods:GooglePaymentMethod[];
  merchantInfo:Record<string,string>;
  transactionInfo:Record<string,string>;
};

type GooglePaymentsClient = {
  isReadyToPay(request:{
    apiVersion:2;
    apiVersionMinor:0;
    allowedPaymentMethods:GooglePaymentMethod[];
  }):Promise<{result:boolean}>;
  createButton(options:{
    onClick:()=>void;
    buttonColor:"black";
    buttonType:"pay";
    buttonSizeMode:"fill";
  }):HTMLElement;
  loadPaymentData(request:GooglePaymentRequest):Promise<unknown>;
};

type GooglePaymentsApi = {
  PaymentsClient:new(options:{environment:GooglePayEnvironment})=>GooglePaymentsClient;
};

declare global {
  interface Window {
    google?:{payments?:{api?:GooglePaymentsApi}};
  }
}

const GOOGLE_PAY_SCRIPT="https://pay.google.com/gp/p/js/pay.js";
let scriptPromise:Promise<void>|null=null;

function loadGooglePayScript():Promise<void>{
  if(typeof window==="undefined")return Promise.reject(new Error("Browser unavailable"));
  if(window.google?.payments?.api?.PaymentsClient)return Promise.resolve();
  if(scriptPromise)return scriptPromise;

  scriptPromise=new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>(
      'script[data-octalve-google-pay="true"]',
    );
    const ready=()=>{
      if(window.google?.payments?.api?.PaymentsClient)resolve();
      else reject(new Error("Google Pay SDK unavailable"));
    };
    if(existing){
      existing.addEventListener("load",ready,{once:true});
      existing.addEventListener("error",()=>reject(new Error("Google Pay SDK failed to load")),{once:true});
      return;
    }

    const script=document.createElement("script");
    script.src=GOOGLE_PAY_SCRIPT;
    script.async=true;
    script.dataset.octalveGooglePay="true";
    script.referrerPolicy="strict-origin-when-cross-origin";
    script.addEventListener("load",ready,{once:true});
    script.addEventListener(
      "error",
      ()=>reject(new Error("Google Pay SDK failed to load")),
      {once:true},
    );
    document.head.appendChild(script);
  }).catch(error=>{
    scriptPromise=null;
    throw error;
  });

  return scriptPromise;
}

function buildCardMethod(config:GooglePayReviewConfig):GooglePaymentMethod|null{
  if(
    !config.tokenization||
    !config.allowed_auth_methods?.length||
    !config.allowed_card_networks?.length
  )return null;

  return {
    type:"CARD",
    parameters:{
      allowedAuthMethods:config.allowed_auth_methods,
      allowedCardNetworks:config.allowed_card_networks,
      billingAddressRequired:config.billing_address_required===true,
      billingAddressParameters:{
        format:"FULL",
        phoneNumberRequired:false,
      },
      assuranceDetailsRequired:config.assurance_details_required===true,
    },
    tokenizationSpecification:config.tokenization,
  };
}

export function GooglePayReviewButton({invoiceId}:{invoiceId:number}){
  const [config,setConfig]=useState<GooglePayReviewConfig|null>(null);
  const [message,setMessage]=useState("");
  const [visible,setVisible]=useState(false);
  const [working,setWorking]=useState(false);
  const containerRef=useRef<HTMLDivElement>(null);
  const clientRef=useRef<GooglePaymentsClient|null>(null);
  const methodRef=useRef<GooglePaymentMethod|null>(null);

  useEffect(()=>{
    let active=true;
    void clientApi.googlePayReviewConfig(invoiceId)
      .then(value=>{
        if(active)setConfig(value);
      })
      .catch(()=>{
        if(active)setConfig({enabled:false,review_only:true,charge_enabled:false});
      });
    return()=>{active=false;};
  },[invoiceId]);

  const openReviewSheet=useCallback(async()=>{
    const client=clientRef.current;
    const method=methodRef.current;
    const current=config;

    if(
      !client||
      !method||
      !current?.enabled||
      current.environment!=="TEST"||
      current.charge_enabled||
      !current.merchant_info||
      !current.transaction_info
    ){
      setMessage("Google Pay review is not available.");
      return;
    }

    setWorking(true);
    setMessage("");
    try{
      // TEST data is deliberately not inspected, logged, persisted or sent to
      // Octalve/Paystack. This release proves the Google integration surface
      // without creating a financial-authority path.
      await client.loadPaymentData({
        apiVersion:2,
        apiVersionMinor:0,
        allowedPaymentMethods:[method],
        merchantInfo:current.merchant_info,
        transactionInfo:current.transaction_info,
      });
      setMessage("Google Pay test completed. No payment was charged.");
    }catch{
      setMessage("Google Pay test was cancelled or could not be completed.");
    }finally{
      setWorking(false);
    }
  },[config]);

  useEffect(()=>{
    if(!config?.enabled||config.environment!=="TEST"||config.charge_enabled)return;
    const method=buildCardMethod(config);
    if(!method)return;

    let active=true;
    void loadGooglePayScript().then(async()=>{
      if(!active)return;
      const Api=window.google?.payments?.api;
      if(!Api?.PaymentsClient)return;

      const client=new Api.PaymentsClient({environment:"TEST"});
      const readiness=await client.isReadyToPay({
        apiVersion:2,
        apiVersionMinor:0,
        allowedPaymentMethods:[method],
      });
      if(!active||!readiness.result)return;

      clientRef.current=client;
      methodRef.current=method;
      const button=client.createButton({
        onClick:()=>{void openReviewSheet();},
        buttonColor:"black",
        buttonType:"pay",
        buttonSizeMode:"fill",
      });
      containerRef.current?.replaceChildren(button);
      setVisible(true);
    }).catch(()=>{
      if(active)setVisible(false);
    });

    return()=>{
      active=false;
      clientRef.current=null;
      methodRef.current=null;
      containerRef.current?.replaceChildren();
    };
  },[config,openReviewSheet]);

  if(!config?.enabled)return null;

  return <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0064E0]" aria-hidden="true"/>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-slate-950">Google Pay integration review</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Google renders this button securely. Review mode uses Google&apos;s TEST environment
          and cannot charge or settle this invoice.
        </p>
      </div>
    </div>
    <div
      ref={containerRef}
      className={`mt-4 min-h-12 w-full ${
        visible&&!working?"opacity-100":"pointer-events-none opacity-60"
      }`}
      aria-busy={working}
    />
    {message?<p role="status" className="mt-3 text-xs leading-5 text-slate-600">{message}</p>:null}
  </section>;
}
