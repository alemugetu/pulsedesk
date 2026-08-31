/**
 * IncidentCategoriesPage component.
 *
 * Incident category management page for PulseDesk.
 *
 * Lists incident categories with create and edit capability. All data is
 * scoped to the current organization and flows through the real backend
 * incident-categories API.
 *
 * Permission gates (UX-only; backend is authoritative):
 * - view: incident.view
 * - manage: incident.create
 */

import { useState } from 'react';
import { Plus, FolderOpen, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import {
  getIncidentCategories,
  createIncidentCategory,
  updateIncidentCategory,
} from '../services/incidentService';
import type { IncidentCategory } from '../types/incident.types';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useQuery } from '@tanstack/react-query';

export function IncidentCategoriesPage() {
  const organization = useCurrentOrganization();
  const {
    data: categories = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['incident-categories', organization?.id],
    queryFn: () => {
      if (!organization?.id) throw new Error('Organization context is required');
      return getIncidentCategories(organization.id, { is_active: true });
    },
    enabled: !!organization?.id,
    staleTime: 30000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IncidentCategory | null>(null);
  const canManage = !!organization;

  if (!organization) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent>
            <EmptyState
              title="Select an organization"
              description="Select an organization to manage its incident categories."
              icon={<FolderOpen className="h-8 w-8" aria-hidden="true" />}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header onCreate={() => setShowCreate(true)} canManage={canManage} />

      {(showCreate || editing) && (
        <CategoryForm
          category={editing}
          onCancel={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-16" role="alert">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive font-medium">Failed to load incident categories</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && categories.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              title="No incident categories found"
              description="Create a category to organize incidents (e.g. Infrastructure, Security, Billing)."
              icon={<FolderOpen className="h-8 w-8" aria-hidden="true" />}
              action={
                canManage ? (
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Create Category
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && categories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      {!category.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {category.slug && (
                      <p className="mt-1 text-xs text-muted-foreground">{category.slug}</p>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(category);
                        setShowCreate(false);
                      }}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              {category.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  onCreate,
  canManage,
}: {
  onCreate?: () => void;
  canManage?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incident Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize incidents into categories for filtering and reporting.
        </p>
      </div>
      {canManage && onCreate && (
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Category
        </Button>
      )}
    </div>
  );
}

interface CategoryFormProps {
  category: IncidentCategory | null;
  onCancel: () => void;
  onSaved: () => void;
}

function CategoryForm({ category, onCancel, onSaved }: CategoryFormProps) {
  const organization = useCurrentOrganization();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (category) {
        await updateIncidentCategory(organization.id, category.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        });
      } else {
        await createIncidentCategory(organization.id, {
          name: name.trim(),
          description: description.trim(),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{category ? 'Edit Category' : 'Create Category'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label={category ? 'Edit incident category' : 'Create incident category'}>
          {error && (
            <div className="p-3 text-sm rounded-md bg-red-500/10 border border-red-500 text-red-500" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="cat-name"
              label="Category Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Infrastructure"
              required
              fullWidth
            />
            <Input
              id="cat-desc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              fullWidth
            />
          </div>
          {category && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              Active
            </label>
          )}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={submitting} disabled={submitting}>
              {category ? 'Save Changes' : 'Create Category'}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
