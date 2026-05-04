import { Clock, LifeBuoy, MessageCircle, Paperclip, Send, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { tickets } from "@/lib/platform-data";

const messages = [
  {
    id: "1",
    author: "Client",
    role: "Customer",
    time: "Apr 30, 15:54",
    body: "I want you to connect my DNS.",
    side: "client"
  },
  {
    id: "2",
    author: "Octalve Support",
    role: "Staff",
    time: "Apr 30, 16:08",
    body: "Please send your registrar login or update nameservers to ns1.octalve.cloud and ns2.octalve.cloud. We can also guide you through DNS records.",
    side: "staff"
  }
];

export default function Page({ params }: { params: { id: string } }) {
  const ticket = tickets.find((item) => item.id === params.id) ?? tickets[0];

  return (
    <main className="page-container">
      <PageHeader
        title="Ticket Conversation"
        description="View support conversation, reply, attach files and track support progress."
        actions={<Button href="/client/support" variant="secondary">Back to Tickets</Button>}
      />

      <section className="ticket-layout">
        <Card padded>
          <div className="ticket-thread-header">
            <div>
              <span className="wallet-kicker">Support ticket</span>
              <h2>{ticket.subject}</h2>
              <p>{ticket.department} · {ticket.priority} priority</p>
            </div>
            <span className="badge orange">{ticket.status}</span>
          </div>

          <div className="ticket-thread">
            {messages.map((message) => (
              <div className={`ticket-message ${message.side}`} key={message.id}>
                <div className="ticket-avatar">
                  {message.side === "client" ? <UserRound size={18} /> : <LifeBuoy size={18} />}
                </div>
                <div className="ticket-bubble">
                  <div className="ticket-message-meta">
                    <strong>{message.author}</strong>
                    <span>{message.role}</span>
                    <small>{message.time}</small>
                  </div>
                  <p>{message.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="reply-box">
            <label className="form-field">
              <span className="form-label">Reply</span>
              <textarea className="textarea" placeholder="Write a clear reply to support..." />
            </label>

            <div className="reply-actions">
              <Button variant="secondary">
                <Paperclip size={16} />
                Attach File
              </Button>
              <Button>
                <Send size={16} />
                Send Reply
              </Button>
            </div>
          </div>
        </Card>

        <aside className="ticket-sidebar">
          <Card padded>
            <div className="section-heading compact">
              <div>
                <h2>Ticket details</h2>
                <p>Support information and SLA readiness.</p>
              </div>
            </div>

            <div className="ticket-detail-list">
              <div><MessageCircle size={17} /><span>Ticket ID</span><strong>{ticket.id}</strong></div>
              <div><Clock size={17} /><span>Last reply</span><strong>{ticket.lastReply}</strong></div>
              <div><ShieldCheck size={17} /><span>Status</span><strong>{ticket.status}</strong></div>
            </div>
          </Card>

          <Card padded>
            <div className="section-heading compact">
              <div>
                <h2>Need faster help?</h2>
                <p>Upgrade to priority support or request migration assistance from checkout/support.</p>
              </div>
            </div>

            <div className="page-actions" style={{ justifyContent: "stretch" }}>
              <Button href="/client/support/new">Open New Ticket</Button>
              <Button href="/client/order/checkout?category=hosting" variant="secondary">Order Support Add-on</Button>
            </div>
          </Card>
        </aside>
      </section>
    </main>
  );
}
