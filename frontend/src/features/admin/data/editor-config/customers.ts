import type {AdminEditorConfig} from "./types";
/** Owner-editable identity and contact fields; no balance, role, payments or privileges. */
export const customersEditorConfig: AdminEditorConfig = {
 key:"customers",listHref:"/admin/customers",newHref:"/admin/customers/new",
 detailLabel:"Customer profile",createTitle:"Add customer",editTitle:"Edit customer",
 description:"Review identity, contact and account access. Wallet balances follow verified payments and ledger entries.",
 fields:[
  {name:"full_name",label:"Full name",type:"text",placeholder:"Full name",required:true},
  {name:"phone_number",label:"Phone number",type:"text",placeholder:"+234…"},
  {name:"company_name",label:"Company / organisation",type:"text",placeholder:"Optional"},
  {name:"address",label:"Street address",type:"textarea",placeholder:"Billing address"},
  {name:"city",label:"City",type:"text"},
  {name:"state",label:"State",type:"text"},
  {name:"country",label:"Country",type:"text"},
  {name:"postal_code",label:"Postal code",type:"text"},
  {name:"tax_id",label:"Tax identifier",type:"text"},
  {name:"status",label:"Account access",type:"select",options:[
    {label:"Active",value:"active"},{label:"Inactive",value:"inactive"},
    {label:"Suspended",value:"suspended"},{label:"Locked",value:"locked"}]},
  {name:"notes",label:"Internal customer notes",type:"textarea",placeholder:"Visible to authorized administrators only"},
 ]
};
