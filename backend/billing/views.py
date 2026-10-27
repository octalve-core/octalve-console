# billing/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from django.http import HttpResponse
from importlib import import_module
from datetime import timedelta
from .invoice_pdf import DEFAULT_TEMPLATE_ID, TEMPLATE_REGISTRY, default_template_id
from .models import Invoice, Tax, Quote
from .serializers import InvoiceSerializer, TaxSerializer, QuoteSerializer, CreateQuoteSerializer
from rbac.decorators import permission_required


class InvoiceWriteAuthority(BasePermission):
    """Never let a customer forge invoice state, totals or payment proof."""

    def has_permission(self, request, view):
        if view.action in ("create", "update", "partial_update", "destroy"):
            user = request.user
            return bool(user and user.is_authenticated and
                        (user.is_superuser or user.role == "admin"))
        return True


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for invoices"""
    
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, InvoiceWriteAuthority]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['invoice_number', 'client__email', 'client__full_name']
    ordering_fields = ['issue_date', 'due_date', 'total']
    ordering = ['-issue_date']
    
    @staticmethod
    def _financial_write_closed():
        return Response(
            {"detail": "Direct invoice editing is unavailable. Payment and invoice changes must use approved billing workflows."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # The legacy ModelViewSet allowed arbitrary financial fields to be
    # submitted through generic Admin CRUD, bypassing the payment ledger.
    # Invoice issuance/amendments need a separate audited and verified API.
    def create(self, request, *args, **kwargs):
        return self._financial_write_closed()

    def update(self, request, *args, **kwargs):
        return self._financial_write_closed()

    def partial_update(self, request, *args, **kwargs):
        return self._financial_write_closed()

    def destroy(self, request, *args, **kwargs):
        return self._financial_write_closed()

    @staticmethod
    def _require_admin(request):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.is_superuser or getattr(user, "role", "") == "admin"))

    @action(detail=False, methods=["get"], url_path="templates")
    def templates(self, request):
        """Read-only reviewed templates; no template upload or editing."""
        if not self._require_admin(request):
            return Response({"detail": "Permission denied."}, status=403)
        return Response({
            "templates": [
                {
                    "id": template_id,
                    "label": "Invoice Template 01",
                    "version": 1,
                    "is_default": template_id == default_template_id(),
                    "preview_path": f"/billing/invoices/template-preview/?template_id={template_id}",
                    "mode": "read_only",
                }
                for template_id in sorted(TEMPLATE_REGISTRY)
            ],
            "editing_enabled": False,
            "issuance_mode": "existing_billing_system",
            "historical_snapshots_ready": False,
        })

    @action(detail=False, methods=["get"], url_path="template-preview")
    def template_preview(self, request):
        """Illustrative PDF only. No customer records or financial mutations."""
        if not self._require_admin(request):
            return Response({"detail": "Permission denied."}, status=403)
        template_id = request.query_params.get("template_id", DEFAULT_TEMPLATE_ID)
        if template_id not in TEMPLATE_REGISTRY:
            return Response({"detail": "Template is not available."}, status=404)
        sample = import_module("billing.invoice-template.preview_template_01").sample()
        document_bytes = import_module(TEMPLATE_REGISTRY[template_id]).render(sample)
        if not isinstance(document_bytes, bytes) or not document_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid invoice template output")
        response = HttpResponse(document_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="octalve-invoice-template-example.pdf"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response

    @action(detail=False, methods=["get"], url_path="renewal-preview")
    def renewal_preview(self, request):
        """Bounded read-only renewal review; never an invoice-creation action.

        Invoice period keys, supplier margin, tax and consent still require a
        separate approved batch. No service shown here is authorised to bill.
        """
        if not self._require_admin(request):
            return Response({"detail": "Permission denied."}, status=403)
        raw_days = request.query_params.get("days", "30")
        if (not isinstance(raw_days, str) or len(raw_days) > 2 or
                not raw_days.isascii() or not raw_days.isdecimal() or
                not 1 <= int(raw_days) <= 90):
            return Response({"days": ["Use 1 to 90 days."]}, status=400)
        from services.models import Service
        now = timezone.now()
        horizon = now + timedelta(days=int(raw_days))
        lower_bound = now - timedelta(days=60)
        # A bounded window and deterministic order avoid unknowable unbounded
        # serverless scans. Older arrears require a separately approved report.
        candidates = list(
            Service.objects.filter(
                next_due_date__gte=lower_bound,
                next_due_date__lte=horizon,
                status__in=("active", "suspended", "cancellation_requested"),
            ).order_by("next_due_date", "pk")[:51]
        )
        results = []
        for service in candidates[:50]:
            existing = Invoice.objects.filter(
                client_id=service.client_id, metadata__type="renewal",
                metadata__service_id=service.pk,
                status__in=("unpaid", "partially_paid", "overdue"),
            ).exists()
            if service.billing_cycle == "once":
                review = "one_time_not_recurring"
            elif existing:
                review = "existing_open_invoice"
            elif not service.auto_renew:
                review = "renewal_not_authorized"
            elif service.status != "active":
                review = "service_not_active"
            else:
                review = "needs_billing_policy_review"
            results.append({
                "id": str(service.pk),
                "label": service.label,
                "description": "Customer service renewal review - no invoice created",
                "status": review,
                "date": service.next_due_date.isoformat(),
                "service_type": service.service_type,
            })
        return Response({
            "results": results,
            "count": len(results),
            "truncated": len(candidates) > 50,
            "as_of": now.isoformat(),
            "window_days": int(raw_days),
            "preview_only": True,
            "billing_enabled": False,
            "message": "Review only. No invoices, charges, renewals or service changes were made.",
        }, headers={"Cache-Control": "private, no-store"})

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Invoice.objects.all()
        return Invoice.objects.filter(client=user)
    
    @action(detail=True, methods=['post'])
    def pay_with_wallet(self, request, pk=None):
        """No unverified wallet debit or invoice-paid shortcut.

        Legacy implementation deducted wallet funds then called invoice.mark_paid()
        without an atomic trusted transaction and recorded amount_due only after
        marking it zero. Block until the wallet ledger and settlement outbox are
        independently qualified; preventing lost money is more important than
        maintaining an unsafe convenience endpoint.
        """
        return Response(
            {'error': 'Wallet invoice payment is temporarily unavailable.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Return a truthful, account-scoped PDF; never fabricate payment evidence."""
        from .invoice_pdf import render_invoice_pdf
        invoice = self.get_object()
        content = render_invoice_pdf(invoice)
        response = HttpResponse(content, content_type="application/pdf")
        # The invoice number is generated by the server, not entered by the user.
        response["Content-Disposition"] = f'attachment; filename="octalve-invoice-{invoice.pk}.pdf"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class TaxViewSet(viewsets.ModelViewSet):
    """ViewSet for taxes (admin only)"""
    
    queryset = Tax.objects.all()
    serializer_class = TaxSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Tax.objects.all()
        return Tax.objects.filter(is_active=True)
    
    @permission_required('manage_settings')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_settings')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)
    
    @permission_required('manage_settings')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class QuoteViewSet(viewsets.ModelViewSet):
    """Existing quotes are viewable but legacy writes lack price authority.

    The prior endpoint trusted caller-supplied amounts and its convert_to_order
    path did not reprice current catalogue/cycles. Do not expose a cheaper order
    creation route than the verified customer checkout.
    """

    serializer_class = QuoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['quote_number', 'client__email']
    ordering = ['-issued_at']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Quote.objects.all()
        return Quote.objects.filter(client=user)

    @staticmethod
    def _unavailable():
        return Response(
            {'detail': 'Quote changes are unavailable until server-priced approvals are enabled.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def create(self, request, *args, **kwargs):
        return self._unavailable()

    def update(self, request, *args, **kwargs):
        return self._unavailable()

    def partial_update(self, request, *args, **kwargs):
        return self._unavailable()

    def destroy(self, request, *args, **kwargs):
        return self._unavailable()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        return self._unavailable()
