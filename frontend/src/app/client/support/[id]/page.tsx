import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export default function Page() {
  return (
    <main className="page-container">
      <PageHeader title="Ticket Conversation" description="View ticket history and reply to support." />
      <Card padded>
        <div className="timeline">
          <div className="timeline-item"><div className="timeline-dot">1</div><div><h2 className="card-title">Client message</h2><p className="card-sub">I want you to connect my DNS.</p></div></div>
          <div className="timeline-item"><div className="timeline-dot">2</div><div><h2 className="card-title">Staff reply</h2><p className="card-sub">Please send your registrar login or update nameservers to ns1.octalve.cloud and ns2.octalve.cloud.</p></div></div>
        </div>
        <div style={{ marginTop: 22 }}>
          <FormField label="Reply" as="textarea" placeholder="Write your reply..." />
          <div className="page-actions" style={{ marginTop: 14 }}><Button>Send Reply</Button></div>
        </div>
      </Card>
    </main>
  );
}
