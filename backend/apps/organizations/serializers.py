from organizations.models import Membership, Organization
from organizations.services import OrganizationService
from rest_framework import serializers


class OrganizationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Organization name is required.')
        return value.strip()

    def validate_slug(self, value):
        if value:
            normalized = Organization.normalize_slug(value)
            if not normalized:
                raise serializers.ValidationError('Enter a valid slug.')
            return normalized
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        slug = validated_data.get('slug') or None
        return OrganizationService.create_organization(
            user=user,
            name=validated_data['name'],
            slug=slug,
        )


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'status', 'created_at', 'updated_at']
        read_only_fields = fields


class MembershipUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class MembershipSerializer(serializers.ModelSerializer):
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'status', 'created_at', 'updated_at']
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['user'] = {
            'id': instance.user.id,
            'email': instance.user.email,
            'first_name': instance.user.first_name,
            'last_name': instance.user.last_name,
        }
        return data
