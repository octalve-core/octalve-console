from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Permission, Role, RolePermission, UserRole
from .utils import get_user_permissions, has_permission


class RolePermissionResolutionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='role-test@example.test',
            username='role-test',
            password='TestOnlyPassphrase123!',
            role='admin',
        )
        self.role = Role.objects.create(name='Catalog editor QA', key='catalog-editor-qa')
        self.permission, _ = Permission.objects.get_or_create(
            key='create_products',
            defaults={
                'name': 'Create products',
                'module': 'products',
                'action': 'create',
            },
        )
        self.mapping = RolePermission.objects.create(
            role=self.role, permission=self.permission,
        )

    def test_unassigned_permission_is_denied_even_for_admin_role(self):
        self.assertFalse(has_permission(self.user, 'create_products'))
        self.assertEqual(get_user_permissions(self.user), set())

    def test_only_current_active_explicit_grants_authorize(self):
        membership = UserRole.objects.create(user=self.user, role=self.role)
        self.assertTrue(has_permission(self.user, 'create_products'))
        self.assertFalse(has_permission(self.user, 'delete_products'))

        self.permission.is_active = False
        self.permission.save(update_fields=['is_active'])
        self.assertFalse(has_permission(self.user, 'create_products'))

        self.permission.is_active = True
        self.permission.save(update_fields=['is_active'])
        self.assertTrue(has_permission(self.user, 'create_products'))

        self.role.is_active = False
        self.role.save(update_fields=['is_active'])
        self.assertFalse(has_permission(self.user, 'create_products'))

        self.role.is_active = True
        self.role.save(update_fields=['is_active'])
        self.assertTrue(has_permission(self.user, 'create_products'))

        membership.delete()
        self.assertFalse(has_permission(self.user, 'create_products'))

    def test_revoked_role_permission_mapping_cannot_remain_authorized(self):
        UserRole.objects.create(user=self.user, role=self.role)
        self.assertTrue(has_permission(self.user, 'create_products'))
        self.mapping.delete()
        self.assertFalse(has_permission(self.user, 'create_products'))
