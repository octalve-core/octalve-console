import {ApiError} from "./client";

function decode(value:string):Uint8Array<ArrayBuffer>{
  return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),byte=>byte.charCodeAt(0));
}

function encode(value:ArrayBuffer):string{
  return btoa(Array.from(new Uint8Array(value),byte=>String.fromCharCode(byte)).join(""))
    .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}

export async function requestPrivilegedPasskey(error:unknown){
  if(!(error instanceof ApiError)||error.status!==428)throw error;
  const challenge=error.payload as {code?:unknown;challenge_id?:unknown;public_key?:{
    challenge?:unknown;rpId?:unknown;allowCredentials?:{id:string}[];
  }}|null;
  const options=challenge?.public_key;
  if(challenge?.code!=="privileged_passkey_required"||typeof challenge.challenge_id!=="string"
    ||typeof options?.challenge!=="string"||options.rpId!==location.hostname||!Array.isArray(options.allowCredentials)){
    throw new Error("The privileged sign-in challenge was invalid.");
  }
  if(!window.isSecureContext||!window.PublicKeyCredential){
    throw new Error("This browser cannot verify your passkey.");
  }
  const credential=await navigator.credentials.get({publicKey:{
    challenge:decode(options.challenge),rpId:options.rpId,timeout:120000,userVerification:"required",
    allowCredentials:options.allowCredentials.map(item=>({type:"public-key",id:decode(item.id)})),
  }});
  if(!(credential instanceof PublicKeyCredential)||!(credential.response instanceof AuthenticatorAssertionResponse)){
    throw new Error("Passkey sign-in was cancelled.");
  }
  const response=credential.response;
  return {passkey_challenge:challenge.challenge_id,passkey_assertion:{
    id:credential.id,rawId:encode(credential.rawId),type:credential.type,
    response:{clientDataJSON:encode(response.clientDataJSON),authenticatorData:encode(response.authenticatorData),
      signature:encode(response.signature),userHandle:response.userHandle?encode(response.userHandle):null},
  }};
}
