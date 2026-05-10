import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { auditLogs } from "@/lib/platform-data";

export default function Page(){
    return <main className="page-container">
        <PageHeader title="Audit Logs" description="Detailed system activity, admin actions, client actions, provider sync and security events."/>
        <DataTable 
            title="Audit timeline" 
            columns={
                [
                    {
                        header:'Time',
                        accessor:'time'
                    },
                    {
                        header:'Actor',
                        accessor:'actor'
                    },
                    {
                        header:'Role',
                        accessor:'role'
                    },
                    {
                        header:'Action',
                        accessor:'action'
                    },
                    {
                        header:'Entity',
                        accessor:'entity'
                    },
                    {
                        header:'Details',
                        accessor:'details'
                    },
                    {
                        header:'IP',
                        accessor:'ip'
                    }
                ]
            } 
            rows={
                auditLogs.map((r,i)=>(
                    {...r,id:String(i)}
                ))
            }
        />
        </main>
}