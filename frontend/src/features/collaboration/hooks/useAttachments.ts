import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getAttachments } from '../services/attachmentService';
import type { Attachment } from '../types/attachment.types';

export function getAttachmentsQueryKey(
  organizationId: string | null,
  incidentId: string | null,
  page?: number
): readonly unknown[] {
  return ['attachments', organizationId, incidentId, { page }] as const;
}

export function useAttachments(incidentId: string | null, page = 1) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getAttachmentsQueryKey(organization?.id || null, incidentId, page);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return getAttachments(organization.id, incidentId, { page });
    },
    enabled: !!organization?.id && !!incidentId,
    staleTime: 30000,
    gcTime: 300000,
  });

  const invalidateAttachments = () => {
    if (organization?.id && incidentId) {
      queryClient.invalidateQueries({
        queryKey: ['attachments', organization.id, incidentId],
      });
    }
  };

  return {
    ...query,
    attachments: (query.data?.results ?? []) as Attachment[],
    invalidateAttachments,
  };
}
