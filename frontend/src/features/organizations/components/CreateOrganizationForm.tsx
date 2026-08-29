/**
 * CreateOrganizationForm component for PulseDesk.
 * 
 * Provides a form to create new organizations with:
 * - Name input (required)
 * - Slug input (optional, auto-generated if not provided)
 * - Validation and error handling
 * - Loading states
 * - Success handling
 * - Accessibility features
 * - Integration with OrganizationContext
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { useOrganizationContext } from '../context/organizationContextDef';
import type { Organization, CreateOrganizationRequest } from '../types/organization';

interface CreateOrganizationFormProps {
  onSuccess?: (organization: Organization) => void;
  onCancel?: () => void;
  className?: string;
}

interface FormErrors {
  name?: string;
  slug?: string;
  general?: string;
}

export function CreateOrganizationForm({
  onSuccess,
  onCancel,
  className,
}: CreateOrganizationFormProps) {
  const { createOrganization, isLoadingCurrent } = useOrganizationContext();
  
  const [formData, setFormData] = useState<CreateOrganizationRequest>({
    name: '',
    slug: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Organization name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Organization name must be at least 2 characters';
    } else if (formData.name.trim().length > 255) {
      newErrors.name = 'Organization name must be less than 255 characters';
    }
    
    if (formData.slug && formData.slug.length > 255) {
      newErrors.slug = 'Slug must be less than 255 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const newOrg = await createOrganization({
        name: formData.name.trim(),
        slug: formData.slug?.trim() || undefined,
      });
      
      setIsSuccess(true);
      
      if (onSuccess) {
        onSuccess(newOrg);
      }
      
      // Reset form after success
      setTimeout(() => {
        setFormData({ name: '', slug: '' });
        setIsSuccess(false);
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create organization';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateOrganizationRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-6', className)}
      aria-label="Create organization form"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Create Organization</h2>
            <p className="text-sm text-muted-foreground">
              Set up a new organization for your team
            </p>
          </div>
        </div>

        {/* Name field */}
        <div className="space-y-2">
          <label
            htmlFor="org-name"
            className="text-sm font-medium text-foreground"
          >
            Organization Name <span className="text-destructive">*</span>
          </label>
          <input
            id="org-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., Acme Corporation"
            disabled={isSubmitting || isSuccess}
            className={cn(
              'w-full px-3 py-2 rounded-md border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              errors.name && 'border-destructive focus:ring-destructive'
            )}
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'org-name-error' : undefined}
          />
          {errors.name && (
            <p
              id="org-name-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.name}
            </p>
          )}
        </div>

        {/* Slug field */}
        <div className="space-y-2">
          <label
            htmlFor="org-slug"
            className="text-sm font-medium text-foreground"
          >
            Slug <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="org-slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleInputChange('slug', e.target.value)}
            placeholder="e.g., acme-corporation"
            disabled={isSubmitting || isSuccess}
            className={cn(
              'w-full px-3 py-2 rounded-md border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              errors.slug && 'border-destructive focus:ring-destructive'
            )}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? 'org-slug-error' : 'org-slug-hint'}
          />
          {errors.slug ? (
            <p
              id="org-slug-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.slug}
            </p>
          ) : (
            <p
              id="org-slug-hint"
              className="text-xs text-muted-foreground"
            >
              Leave blank to auto-generate from organization name
            </p>
          )}
        </div>

        {/* General error */}
        {errors.general && (
          <div
            className="p-3 rounded-md bg-destructive/10 border border-destructive/20"
            role="alert"
          >
            <p className="text-sm text-destructive">{errors.general}</p>
          </div>
        )}

        {/* Success message */}
        {isSuccess && (
          <div
            className="p-3 rounded-md bg-green-500/10 border border-green-500/20"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Organization created successfully!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting || isSuccess}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || isSuccess || isLoadingCurrent}
          className="min-w-[120px]"
        >
          {isSubmitting || isLoadingCurrent ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Created
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </div>
    </form>
  );
}
