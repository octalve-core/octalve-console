import assert from "node:assert/strict";
import test from "node:test";
import {
 parsePaidInvoiceCount,parseGatewayCounts,parseProductCounts,parseDefinitions,parseInstances,
} from "../src/features/admin/reports/lib/report-presentation.ts";

test("revenue count comes from the authorized payload, not fabricated totals",()=>{
 assert.equal(parsePaidInvoiceCount({invoice_count:0,total_revenue:"1000"}),0);
 assert.equal(parsePaidInvoiceCount({invoice_count:"23"}),23);
 assert.throws(()=>parsePaidInvoiceCount({total_revenue:123}),/Invalid reporting count/);
 assert.throws(()=>parsePaidInvoiceCount({invoice_count:"2.1"}),/Invalid reporting count/);
});
test("transaction and invoice-item groups use their actual counts",()=>{
 assert.deepEqual(parseGatewayCounts([{gateway__name:"Gateway A",count:3,total:"5000"},{gateway__name:"Gateway B",count:7,total:"99999"}]),
  [{label:"Gateway B",count:7},{label:"Gateway A",count:3}]);
 assert.deepEqual(parseProductCounts({results:[{description:"Hosting",count:2}]}),[{label:"Hosting",count:2}]);
 assert.throws(()=>parseProductCounts({results:[{description:"Bad",count:-1}]}),/Invalid reporting count/);
});
test("definitions and history reject malformed records and preserve unknown activation",()=>{
 assert.deepEqual(parseDefinitions({results:[{id:3,name:"Revenue",report_type:"revenue"}]})[0].active,null);
 assert.equal(parseDefinitions([{id:1,name:"Reports",is_active:true}])[0].active,true);
 assert.equal(parseInstances([{id:17,title:"Quarterly",status:"pending",file_format:"pdf"}])[0].format,"pdf");
 assert.throws(()=>parseDefinitions([{name:"No ID"}]),/identifier/);
 assert.throws(()=>parseInstances({results:"not an array"}),/Unexpected reporting list/);
});
