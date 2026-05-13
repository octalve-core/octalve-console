# catalog/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import ProductCategory, Product, Plan, PlanProviderMapping
from .serializers import (
    ProductCategorySerializer, ProductSerializer, PlanSerializer, 
    PlanProviderMappingSerializer
)
from rbac.decorators import permission_required

class ProductCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for product categories"""
    
    queryset = ProductCategory.objects.filter(is_active=True)
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['sort_order', 'name']
    
    @permission_required('view_products')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    @permission_required('create_products')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('update_products')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)
    
    @permission_required('delete_products')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class ProductViewSet(viewsets.ModelViewSet):
    """ViewSet for products"""
    
    queryset = Product.objects.filter(status='active', is_public=True)
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'product_type', 'status']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'sort_order', 'base_price']
    
    def get_queryset(self):
        """Filter based on user role"""
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Product.objects.all()
        return Product.objects.filter(status='active', is_public=True)
    
    @permission_required('view_products')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    @permission_required('create_products')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def plans(self, request, pk=None):
        """Get all plans for a product"""
        product = self.get_object()
        plans = Plan.objects.filter(product=product, status='active')
        serializer = PlanSerializer(plans, many=True)
        return Response(serializer.data)


class PlanViewSet(viewsets.ModelViewSet):
    """ViewSet for plans"""
    
    queryset = Plan.objects.filter(status='active', is_public=True)
    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['product', 'status', 'is_popular']
    search_fields = ['name', 'description']
    
    def get_queryset(self):
        """Filter based on user role"""
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Plan.objects.all()
        return Plan.objects.filter(status='active', is_public=True)
    
    @permission_required('view_products')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class PlanProviderMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for plan-provider mappings (admin only)"""
    
    queryset = PlanProviderMapping.objects.filter(is_active=True)
    serializer_class = PlanProviderMappingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only staff/admin can see mappings"""
        user = self.request.user
        if user.role in ['admin', 'staff'] or user.is_superuser:
            return PlanProviderMapping.objects.all()
        return PlanProviderMapping.objects.none()
    
    @permission_required('manage_providers')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_providers')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

