"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Globe2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { domains } from "@/lib/platform-data";

type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "SRV";

type DnsStatus = "Synced" | "Ready" | "Pending";

type DnsRecord = {
  id: string;
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: string;
  status: DnsStatus;
  priority?: string;
};

type DnsRecordForm = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: string;
  priority: string;
};

const defaultDnsRecords: DnsRecord[] = [
  {
    id: "dns-a-root",
    type: "A",
    name: "@",
    value: "192.0.2.1",
    ttl: "Automatic",
    status: "Synced"
  },
  {
    id: "dns-cname-www",
    type: "CNAME",
    name: "www",
    value: "@",
    ttl: "Automatic",
    status: "Synced"
  },
  {
    id: "dns-mx-root",
    type: "MX",
    name: "@",
    value: "mail.octalve.cloud",
    ttl: "Automatic",
    status: "Ready",
    priority: "10"
  },
  {
    id: "dns-txt-spf",
    type: "TXT",
    name: "@",
    value: "v=spf1 include:octalve.cloud ~all",
    ttl: "Automatic",
    status: "Ready"
  }
];

const emptyForm: DnsRecordForm = {
  type: "A",
  name: "",
  value: "",
  ttl: "Automatic",
  priority: ""
};

function statusClass(status: DnsStatus) {
  if (status === "Synced") return "badge green";
  if (status === "Pending") return "badge orange";
  return "badge";
}

export default function Page({ params }: { params: { id: string } }) {
  const domain = useMemo(() => {
    return (
      domains.find((item) => item.id === params.id || item.domain === params.id) ??
      domains[0]
    );
  }, [params.id]);

  const [records, setRecords] = useState<DnsRecord[]>(defaultDnsRecords);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<DnsRecordForm>(emptyForm);
  const [nameservers, setNameservers] = useState({
    ns1: "ns1.octalve.cloud",
    ns2: "ns2.octalve.cloud"
  });
  const [autoRenew, setAutoRenew] = useState(domain.autoRenew || "On");
  const [syncMessage, setSyncMessage] = useState("DNS records are synced");
  const [notice, setNotice] = useState("");

  function openAddRecord() {
    setEditingRecordId(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
  }

  function openEditRecord(record: DnsRecord) {
    setEditingRecordId(record.id);
    setForm({
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl,
      priority: record.priority ?? ""
    });
    setEditorOpen(true);
    setNotice("");
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingRecordId(null);
    setForm(emptyForm);
  }

  function saveRecord() {
    if (!form.name.trim() || !form.value.trim()) {
      setNotice("Please add the record name and value before saving.");
      return;
    }

    if (editingRecordId) {
      setRecords((current) =>
        current.map((record) =>
          record.id === editingRecordId
            ? {
                ...record,
                type: form.type,
                name: form.name.trim(),
                value: form.value.trim(),
                ttl: form.ttl || "Automatic",
                priority: form.priority.trim() || undefined,
                status: "Pending"
              }
            : record
        )
      );

      setNotice("DNS record updated. It will sync through the domain/DNS adapter when backend is connected.");
    } else {
      setRecords((current) => [
        ...current,
        {
          id: `dns-${Date.now()}`,
          type: form.type,
          name: form.name.trim(),
          value: form.value.trim(),
          ttl: form.ttl || "Automatic",
          priority: form.priority.trim() || undefined,
          status: "Pending"
        }
      ]);

      setNotice("DNS record added. It will sync through the domain/DNS adapter when backend is connected.");
    }

    closeEditor();
  }

  function deleteRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id));
    setNotice("DNS record removed from this view. Backend deletion will be handled by the DNS adapter endpoint.");
  }

  function saveNameservers() {
    setNotice("Nameserver settings saved. Backend will submit this through the registrar/domain adapter.");
  }

  function refreshSync() {
    setSyncMessage("Last checked just now");
    setRecords((current) =>
      current.map((record) => ({
        ...record,
        status: record.status === "Pending" ? "Ready" : record.status
      }))
    );
  }

  return (
    <main className="page-container">
      <PageHeader
        title="Manage Domain"
        description="Manage nameservers, DNS records, renewal settings and domain security controls."
        actions={
          <div className="page-actions">
            <button type="button" className="button secondary" onClick={refreshSync}>
              <RefreshCw size={17} />
              Refresh Sync
            </button>
            <button type="button" className="button">
              Renew Domain
            </button>
          </div>
        }
      />

      {notice ? <div className="notice domain-notice">{notice}</div> : null}

      <div className="domain-detail-layout">
        <Card padded>
          <div className="domain-hero-card">
            <div className="domain-hero-icon">
              <Globe2 size={28} />
            </div>

            <div>
              <p className="eyebrow">Domain</p>
              <h2>{domain.domain}</h2>
              <span>
                Active domain with renewal, DNS, nameserver and security management.
              </span>
            </div>

            <span className="badge green">{domain.status}</span>
          </div>

          <div className="domain-metric-grid">
            <div>
              <span>Renewal date</span>
              <strong>{domain.renewal}</strong>
            </div>

            <div>
              <span>Expiry date</span>
              <strong>{domain.expiry}</strong>
            </div>

            <div>
              <span>Auto-renew</span>
              <strong>{autoRenew}</strong>
            </div>

            <div>
              <span>DNS status</span>
              <strong>{syncMessage}</strong>
            </div>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <h2>Domain protection</h2>
              <p>Keep the domain secure, renewed and properly connected to hosting or email services.</p>
            </div>
          </div>

          <div className="domain-action-list">
            <div>
              <ShieldCheck size={18} />
              <span>Domain lock</span>
              <strong>Enabled</strong>
            </div>

            <div>
              <CalendarClock size={18} />
              <span>Auto renewal</span>
              <select
                className="select compact-select"
                value={autoRenew}
                onChange={(event) => setAutoRenew(event.target.value)}
              >
                <option>On</option>
                <option>Off</option>
              </select>
            </div>

            <div>
              <Lock size={18} />
              <span>Privacy status</span>
              <strong>Protected</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card padded style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <h2>Nameservers</h2>
            <p>Point this domain to Octalve Cloud or any external hosting provider.</p>
          </div>

          <button type="button" className="button secondary" onClick={saveNameservers}>
            <Save size={17} />
            Save Nameservers
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-label">Nameserver 1</span>
            <input
              className="input"
              value={nameservers.ns1}
              onChange={(event) =>
                setNameservers((current) => ({ ...current, ns1: event.target.value }))
              }
            />
          </label>

          <label className="form-field">
            <span className="form-label">Nameserver 2</span>
            <input
              className="input"
              value={nameservers.ns2}
              onChange={(event) =>
                setNameservers((current) => ({ ...current, ns2: event.target.value }))
              }
            />
          </label>
        </div>
      </Card>

      <Card padded style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <h2>DNS records</h2>
            <p>Add and manage A, AAAA, CNAME, MX, TXT and SRV records.</p>
          </div>

          <button type="button" className="button" onClick={openAddRecord}>
            <Plus size={17} />
            Add Record
          </button>
        </div>

        {editorOpen ? (
          <div className="dns-editor-card">
            <div className="section-heading">
              <div>
                <h2>{editingRecordId ? "Edit DNS record" : "Add DNS record"}</h2>
                <p>Changes are prepared for backend DNS adapter synchronization.</p>
              </div>

              <button type="button" className="button secondary" onClick={closeEditor}>
                <X size={17} />
                Close
              </button>
            </div>

            <div className="dns-form-grid">
              <label className="form-field">
                <span className="form-label">Type</span>
                <select
                  className="select"
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as DnsRecordType
                    }))
                  }
                >
                  <option>A</option>
                  <option>AAAA</option>
                  <option>CNAME</option>
                  <option>MX</option>
                  <option>TXT</option>
                  <option>SRV</option>
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Name / Host</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="@, www, mail"
                />
              </label>

              <label className="form-field dns-value-field">
                <span className="form-label">Value / Points to</span>
                <input
                  className="input"
                  value={form.value}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, value: event.target.value }))
                  }
                  placeholder="192.0.2.1 or target hostname"
                />
              </label>

              <label className="form-field">
                <span className="form-label">TTL</span>
                <select
                  className="select"
                  value={form.ttl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ttl: event.target.value }))
                  }
                >
                  <option>Automatic</option>
                  <option>300</option>
                  <option>900</option>
                  <option>1800</option>
                  <option>3600</option>
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Priority</span>
                <input
                  className="input"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value }))
                  }
                  placeholder="Only for MX/SRV"
                />
              </label>
            </div>

            <div className="page-actions" style={{ marginTop: 16 }}>
              <button type="button" className="button" onClick={saveRecord}>
                <Save size={17} />
                {editingRecordId ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="table dns-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Value</th>
                <th>TTL</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <span className="badge">{record.type}</span>
                  </td>
                  <td>{record.name}</td>
                  <td>{record.value}</td>
                  <td>{record.ttl}</td>
                  <td>{record.priority || "-"}</td>
                  <td>
                    <span className={statusClass(record.status)}>{record.status}</span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="text-link icon-text-button"
                        onClick={() => openEditRecord(record)}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="text-link danger-link icon-text-button"
                        onClick={() => deleteRecord(record.id)}
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <h2>Recommended next steps</h2>
            <p>Improve this domain with connected hosting, email and SSL services.</p>
          </div>
        </div>

        <div className="module-grid">
          <a className="module-card" href="/client/order/checkout?category=hosting">
            <h3>Connect hosting</h3>
            <p>Attach this domain to a shared hosting or VPS package.</p>
          </a>

          <a className="module-card" href="/client/order/checkout?category=email">
            <h3>Add business email</h3>
            <p>Create professional email addresses using this domain.</p>
          </a>

          <a className="module-card" href="/client/order/checkout?category=security">
            <h3>Add SSL protection</h3>
            <p>Secure the domain with an SSL certificate.</p>
          </a>
        </div>
      </Card>
    </main>
  );
}
