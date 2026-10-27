import {api} from "@/lib/api/client";
export type DraftConnection={
 id:string;adapter_key:string;label:string;environment:"test"|"live";
 state:"draft"|"revoked";credential_version:number;credential_configured:boolean;execution_enabled:false;
};
type ConnectionResponse={results:DraftConnection[];truncated:boolean;execution_enabled:false};
type SchemaResponse={integrations:{key:string;enabled_for_execution:false}[];execution_enabled:false};
export async function readConnectionOverview(){
 const [records,schema]=await Promise.all([
  api.get<ConnectionResponse>("/providers/connections/"),
  api.get<SchemaResponse>("/providers/connections/schemas/")
 ]);
 if(records.execution_enabled!==false||schema.execution_enabled!==false||
    !Array.isArray(records.results)||!Array.isArray(schema.integrations)){
  throw new Error("Connection status cannot be verified.");
 }
 return {
  connections:records.results.filter(c=>c&&typeof c.adapter_key==="string"&&
   (c.state==="draft"||c.state==="revoked")&&c.execution_enabled===false).slice(0,50),
  supported:new Set(schema.integrations.filter(x=>x.enabled_for_execution===false).map(x=>x.key)),
  truncated:records.truncated,
 };
}
