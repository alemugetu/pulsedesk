/**
 * SlaPolicyForm component.
 * 
 * Form for creating/updating SLA policies.
 * Backend supports CRUD operations for SLA policies.
 * Uses existing form/input/button components where possible.
 * Provides validation, accessible labels, error messages, submission state, and success handling.
 */

import { useState } from 'react';
import type { SLAPolicyCreateRequest } from '../types/sla.types';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useOrganizationContext } from '../../organizations/context/organizationContextDef';
import { createSlaPolicy } from '../services/slaService';
import { useQueryClient } from '@tanstack/react-query';

interface SlaPolicyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  general?: string;
}

export function SlaPolicyForm({ onSuccess, onCancel, className = '' }: SlaPolicyFormProps) {
  const { currentOrganization: organization, hasPermission } = useOrganizationContext();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    is_default: false,
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hasPermission('sla.manage')) {
    return null;
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'SLA policy name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!organization?.id) {
      setErrors({ general: 'Organization context is required' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const createData: SLAPolicyCreateRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      await createSlaPolicy(organization.id, createData);

      // Invalidate SLA policies query
      queryClient.invalidateQueries({
        queryKey: ['sla-policies', organization.id],
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        is_active: true,
        is_default: false,
      });

      // Call success callback
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create SLA policy';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create SLA Policy</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
              {errors.general}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Policy Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Standard SLA Policy"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-red-600">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Optional description of the SLA policy"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleInputChange('is_active', e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Active</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => handleInputChange('is_default', e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Default Policy</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Policy'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
