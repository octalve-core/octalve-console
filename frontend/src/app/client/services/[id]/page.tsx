import {ClientServiceDetailView} from "@/features/client/views/ClientServiceDetailView";

/** Exact owner-authorized GET. Never search a paginated list for a detail ID. */
export default function ClientServiceDetailPage(){
  return <ClientServiceDetailView/>;
}
