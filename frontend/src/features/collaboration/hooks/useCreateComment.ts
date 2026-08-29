import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { createComment } from '../services/commentService';
import type { CreateCommentRequest } from '../types/comment.types';

export function useCreateComment(incidentId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateCommentRequest) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return createComment(organization.id, incidentId, data);
    },
    onSuccess: () => {
      if (organization?.id && incidentId) {
        queryClient.invalidateQueries({
          queryKey: ['comments', organization.id, incidentId],
        });
      }
    },
  });

  return mutation;
}
