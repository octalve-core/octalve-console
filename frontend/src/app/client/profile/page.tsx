import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ClientAccountSettingsPage() {
  return (
    <main className="page-container">
      <PageHeader
        title="Account Settings"
        description="Manage your personal details, contact information, password, billing profile and notification preferences."
        actions={
          <>
            <Button variant="secondary" href="/client">
              Back to Dashboard
            </Button>
            <Button>Save Changes</Button>
          </>
        }
      />

      <div className="grid cols-2">
        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Client Profile</p>
              <h2>Personal Information</h2>
              <p>Keep your account details accurate for invoices, tickets, service notices and domain records.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Full Name</span>
              <input className="input" defaultValue="Brand De" />
            </label>

            <label className="form-field">
              <span className="form-label">Email Address</span>
              <input className="input" defaultValue="hellobrandde@gmail.com" />
            </label>

            <label className="form-field">
              <span className="form-label">Phone Number</span>
              <input className="input" defaultValue="0813 575 0956" />
            </label>

            <label className="form-field">
              <span className="form-label">Company / Brand Name</span>
              <input className="input" defaultValue="Brand De" />
            </label>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Billing Profile</p>
              <h2>Invoice Details</h2>
              <p>These details should appear on customer invoices, receipts and official billing records.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Billing Name</span>
              <input className="input" defaultValue="Brand De" />
            </label>

            <label className="form-field">
              <span className="form-label">Tax ID / RC Number</span>
              <input className="input" placeholder="Optional" />
            </label>

            <label className="form-field" style={{ gridColumn: "1 / -1" }}>
              <span className="form-label">Billing Address</span>
              <textarea
                className="textarea"
                defaultValue="Lagos, Nigeria"
              />
            </label>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Security</p>
              <h2>Password & Access</h2>
              <p>Update your password and protect your account from unauthorized access.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="form-label">Current Password</span>
              <input className="input" type="password" placeholder="••••••••" />
            </label>

            <label className="form-field">
              <span className="form-label">New Password</span>
              <input className="input" type="password" placeholder="••••••••" />
            </label>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>Communication Preferences</h2>
              <p>Choose what kind of system emails and service notices you want to receive.</p>
            </div>
          </div>

          <div className="grid">
            <label className="actions">
              <input type="checkbox" defaultChecked />
              <span>Invoice and payment notifications</span>
            </label>

            <label className="actions">
              <input type="checkbox" defaultChecked />
              <span>Service expiry and renewal reminders</span>
            </label>

            <label className="actions">
              <input type="checkbox" defaultChecked />
              <span>Support ticket replies</span>
            </label>

            <label className="actions">
              <input type="checkbox" />
              <span>Product updates and promotional messages</span>
            </label>
          </div>
        </Card>
      </div>
    </main>
  );
}
