export type NotificationTemplate = {
  id: string;
  subject: string;
  trigger: string;
  recipient: string;
  enabled: boolean;
  description: string;
  variables: string[];
  htmlBody: string;
  textBody: string;
};

export const notificationTemplates: NotificationTemplate[] = [
  {
    id: "new-login-detected",
    subject: "New login detected",
    trigger: "auth.login",
    recipient: "User",
    enabled: true,
    description: "Sent when a user signs in from a new browser, location or device.",
    variables: ["{{ user.name }}", "{{ login.ip }}", "{{ login.device }}", "{{ login.time }}"],
    htmlBody: "<h1>New login detected</h1><p>Hello {{ user.name }}, we noticed a login to your Octalve Console account.</p>",
    textBody: "Hello {{ user.name }}, we noticed a login to your Octalve Console account."
  },
  {
    id: "new-invoice-created",
    subject: "New invoice created",
    trigger: "invoice.created",
    recipient: "Client",
    enabled: true,
    description: "Sent when a new invoice is created for a client.",
    variables: ["{{ client.name }}", "{{ invoice.number }}", "{{ invoice.total }}", "{{ invoice.due_date }}"],
    htmlBody: "<h1>Invoice {{ invoice.number }}</h1><p>Your invoice of {{ invoice.total }} is ready.</p>",
    textBody: "Your invoice {{ invoice.number }} of {{ invoice.total }} is ready."
  },
  {
    id: "new-order-created",
    subject: "New order created",
    trigger: "order.created",
    recipient: "Admin",
    enabled: true,
    description: "Sent when a customer places a new order.",
    variables: ["{{ order.id }}", "{{ client.name }}", "{{ order.total }}", "{{ order.status }}"],
    htmlBody: "<h1>New order received</h1><p>Order {{ order.id }} was created by {{ client.name }}.</p>",
    textBody: "Order {{ order.id }} was created by {{ client.name }}."
  },
  {
    id: "server-activated",
    subject: "Server activated",
    trigger: "service.activated",
    recipient: "Client",
    enabled: true,
    description: "Sent after a hosting, VPS or service is successfully provisioned.",
    variables: ["{{ client.name }}", "{{ service.name }}", "{{ service.login_url }}", "{{ service.renewal_date }}"],
    htmlBody: "<h1>Your service is active</h1><p>{{ service.name }} is now active.</p>",
    textBody: "{{ service.name }} is now active."
  },
  {
    id: "server-suspended",
    subject: "Server suspended",
    trigger: "service.suspended",
    recipient: "Client",
    enabled: true,
    description: "Sent when a service is suspended due to overdue billing or admin action.",
    variables: ["{{ client.name }}", "{{ service.name }}", "{{ invoice.number }}", "{{ invoice.due }}"],
    htmlBody: "<h1>Service suspended</h1><p>{{ service.name }} has been suspended.</p>",
    textBody: "{{ service.name }} has been suspended."
  },
  {
    id: "server-terminated",
    subject: "Server terminated",
    trigger: "service.terminated",
    recipient: "Client/Admin",
    enabled: true,
    description: "Sent when a service is terminated.",
    variables: ["{{ service.name }}", "{{ service.id }}", "{{ termination.reason }}"],
    htmlBody: "<h1>Service terminated</h1><p>{{ service.name }} has been terminated.</p>",
    textBody: "{{ service.name }} has been terminated."
  },
  {
    id: "new-ticket-reply",
    subject: "New ticket reply",
    trigger: "ticket.reply",
    recipient: "Client/Staff",
    enabled: true,
    description: "Sent when a support ticket receives a reply.",
    variables: ["{{ ticket.id }}", "{{ ticket.subject }}", "{{ reply.author }}", "{{ ticket.url }}"],
    htmlBody: "<h1>New ticket reply</h1><p>{{ reply.author }} replied to {{ ticket.subject }}.</p>",
    textBody: "{{ reply.author }} replied to {{ ticket.subject }}."
  },
  {
    id: "email-verification",
    subject: "Email verification",
    trigger: "auth.verify_email",
    recipient: "User",
    enabled: true,
    description: "Sent when a user needs to verify their email address.",
    variables: ["{{ user.name }}", "{{ verification.url }}"],
    htmlBody: "<h1>Verify your email</h1><p>Click the verification link to continue.</p>",
    textBody: "Verify your email: {{ verification.url }}"
  },
  {
    id: "password-reset",
    subject: "Password reset",
    trigger: "auth.password_reset",
    recipient: "User",
    enabled: true,
    description: "Sent when a user requests a password reset.",
    variables: ["{{ user.name }}", "{{ reset.url }}", "{{ reset.expires_at }}"],
    htmlBody: "<h1>Password reset</h1><p>Use this link to reset your password.</p>",
    textBody: "Reset your password: {{ reset.url }}"
  },
  {
    id: "service-cancellation-received",
    subject: "Service cancellation received",
    trigger: "service.cancellation_requested",
    recipient: "Client/Admin",
    enabled: true,
    description: "Sent when a client requests service cancellation.",
    variables: ["{{ client.name }}", "{{ service.name }}", "{{ cancellation.reason }}"],
    htmlBody: "<h1>Cancellation request received</h1><p>We received your cancellation request for {{ service.name }}.</p>",
    textBody: "We received your cancellation request for {{ service.name }}."
  }
];

export function getNotificationTemplate(id: string) {
  return notificationTemplates.find((template) => template.id === id) || notificationTemplates[0];
}
