import {api,ApiError} from "./client";

function decode(value:string):Uint8Array<ArrayBuffer>{
  return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),byte=>byte.charCodeAt(0));
}

function encode(value:ArrayBuffer):string{
  return btoa(Array.from(new Uint8Array(value),byte=>String.fromCharCode(byte)).join(""))
    .replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}

export async function requestPrivilegedPasskey(error:unknown){
  if(!(error instanceof ApiError)||error.status!==428)throw error;
  const challenge=error.payload as {code?:unknown;challenge_id?:unknown;continuation?:unknown;public_key?:{
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
  return {passkey_challenge:challenge.challenge_id,
    ...(typeof challenge.continuation==="string" ? {passkey_continuation:challenge.continuation} : {}),passkey_assertion:{
    id:credential.id,rawId:encode(credential.rawId),type:credential.type,
    response:{clientDataJSON:encode(response.clientDataJSON),authenticatorData:encode(response.authenticatorData),
      signature:encode(response.signature),userHandle:response.userHandle?encode(response.userHandle):null},
  }};
}

type EnrollmentReply={
  public_key:Omit<PublicKeyCredentialCreationOptions,"challenge"|"user"|"excludeCredentials"> & {
    challenge:string;
    user:Omit<PublicKeyCredentialUserEntity,"id"> & {id:string};
    excludeCredentials?:{id:string;type:PublicKeyCredentialType}[];
  };
};

export async function enrollPrivilegedPasskey(code:string,password:string){
  if(!window.isSecureContext||!window.PublicKeyCredential){
    throw new Error("This browser cannot set up your passkey.");
  }
  const path="/auth/passkeys/enroll/";
  const {public_key:options}=await api.post<EnrollmentReply>(path,{code,password},{skipAuth:true});
  if(options.rp.id!==location.hostname){
    throw new Error("The passkey setup origin was invalid.");
  }
  let credential:Credential|null;
  try {
    credential=await navigator.credentials.create({publicKey:{
    ...options,challenge:decode(options.challenge),user:{...options.user,id:decode(options.user.id)},
    excludeCredentials:options.excludeCredentials?.map(item=>({...item,id:decode(item.id)})),
    authenticatorSelection:{...options.authenticatorSelection,userVerification:"required"},
  }});
  } catch(error) {
    if(error instanceof DOMException && error.name==="InvalidStateError") throw new Error("This authenticator already contains a registered passkey. Use a separate security key or passkey manager. Do not delete your existing passkey.");
    if(error instanceof DOMException && error.name==="NotAllowedError") throw new Error("Passkey setup was cancelled or timed out. Try again with an independent authenticator if your setup code is still valid.");
    throw error;
  }
  if(!(credential instanceof PublicKeyCredential)||!(credential.response instanceof AuthenticatorAttestationResponse)){
    throw new Error("Passkey setup was cancelled.");
  }
  const response=credential.response;
  await api.post(path,{code,password,credential:{
    id:credential.id,rawId:encode(credential.rawId),type:credential.type,
    response:{clientDataJSON:encode(response.clientDataJSON),attestationObject:encode(response.attestationObject)},
  }},{skipAuth:true});
}
