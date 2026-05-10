# settings_registry/serializers.py

from rest_framework import serializers
from .models import SettingGroup, Setting, SettingChangeLog, EmailTemplate, BrandingSettings, TaxSettings, SystemConfig


class SettingGroupSerializer(serializers.ModelSerializer):
    """Serializer for setting groups"""
    
    settings_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SettingGroup
        fields = ['id', 'key', 'name', 'description', 'icon', 'sort_order', 'is_active', 'settings_count']
        read_only_fields = ['id']
    
    def get_settings_count(self, obj):
        return obj.settings.filter(is_deprecated=False).count()


class SettingSerializer(serializers.ModelSerializer):
    """Serializer for settings"""
    
    group_key = serializers.CharField(source='group.key', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    data_type_display = serializers.CharField(source='get_data_type_display', read_only=True)
    current_value = serializers.SerializerMethodField()
    
    class Meta:
        model = Setting
        fields = [
            'id', 'group', 'group_key', 'group_name', 'key', 'name', 'description',
            'data_type', 'data_type_display', 'current_value', 'default_value',
            'validation_rules', 'placeholder', 'options', 'is_required',
            'is_encrypted', 'is_public', 'is_deprecated', 'sort_order', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_current_value(self, obj):
        return obj.get_value()
    
    def update(self, instance, validated_data):
        # Handle value separately
        value = self.initial_data.get('value')
        instance.set_value(value)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        return instance


class SettingUpdateSerializer(serializers.Serializer):
    """Serializer for batch setting updates"""
    
    settings = serializers.DictField(child=serializers.CharField(allow_blank=True, allow_null=True))


class SettingChangeLogSerializer(serializers.ModelSerializer):
    """Serializer for setting change logs"""
    
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    setting_key = serializers.CharField(source='setting.key', read_only=True)
    setting_name = serializers.CharField(source='setting.name', read_only=True)
    
    class Meta:
        model = SettingChangeLog
        fields = ['id', 'setting', 'setting_key', 'setting_name', 'changed_by', 'changed_by_name', 'old_value', 'new_value', 'changed_at']


class EmailTemplateSerializer(serializers.ModelSerializer):
    """Serializer for email templates"""
    
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'key', 'name', 'category', 'category_display', 'description',
            'subject', 'subject_variables', 'body_html', 'body_text',
            'variables', 'is_active', 'is_system', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmailTestSerializer(serializers.Serializer):
    """Serializer for testing email templates"""
    
    template_id = serializers.IntegerField()
    recipient = serializers.EmailField()
    variables = serializers.DictField(required=False, default=dict)


class BrandingSettingsSerializer(serializers.ModelSerializer):
    """Serializer for branding settings"""
    
    class Meta:
        model = BrandingSettings
        fields = [
            'company_name', 'company_logo', 'company_favicon', 'company_email',
            'company_phone', 'company_address', 'company_website', 'primary_color',
            'secondary_color', 'accent_color', 'email_logo', 'email_footer',
            'invoice_logo', 'invoice_footer', 'invoice_notes', 'portal_title', 'portal_description'
        ]


class TaxSettingsSerializer(serializers.ModelSerializer):
    """Serializer for tax settings"""
    
    tax_calculation_display = serializers.CharField(source='get_tax_calculation_display', read_only=True)
    
    class Meta:
        model = TaxSettings
        fields = '__all__'
        read_only_fields = ['id']


class SystemConfigSerializer(serializers.ModelSerializer):
    """Serializer for system configuration"""
    
    class Meta:
        model = SystemConfig
        fields = '__all__'
        read_only_fields = ['id']


class SystemHealthSerializer(serializers.Serializer):
    """Serializer for system health status"""
    
    status = serializers.CharField()
    checks = serializers.DictField()
    timestamp = serializers.DateTimeField()