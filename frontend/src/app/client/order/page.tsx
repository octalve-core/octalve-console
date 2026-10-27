import {Suspense} from "react";
import {ClientOrderView} from "@/features/client/views/ClientOrderView";

export default function ClientOrderPage(){
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-console-muted">
    Loading order options…
  </div>}>
    <ClientOrderView/>
  </Suspense>;
}
