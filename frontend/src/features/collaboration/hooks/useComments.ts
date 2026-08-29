import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { getComments } from '../services/commentService';
import type { Comment } from '../types/comment.types';

export function getCommentsQueryKey(
  organizationId: string | null,
  incidentId: string | null,
  page?: number
): readonly unknown[] {
  return ['comments', organizationId, incidentId, { page }] as const;
}

export function useComments(incidentId: string | null, page = 1) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const queryKey = getCommentsQueryKey(organization?.id || null, incidentId, page);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return getComments(organization.id, incidentId, { page });
    },
    enabled: !!organization?.id && !!incidentId,
    staleTime: 30000,
    gcTime: 300000,
  });

  const invalidateComments = () => {
    if (organization?.id && incidentId) {
      queryClient.invalidateQueries({
        queryKey: ['comments', organization.id, incidentId],
      });
    }
  };

  return {
    ...query,
    comments: (query.data?.results ?? []) as Comment[],
    invalidateComments,
  };
}
