import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { deleteAttachment } from '../services/attachmentService';

export function useDeleteAttachment(incidentId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return deleteAttachment(organization.id, incidentId, attachmentId);
    },
    onSuccess: () => {
      if (organization?.id && incidentId) {
        queryClient.invalidateQueries({
          queryKey: ['attachments', organization.id, incidentId],
        });
      }
    },
  });

  return mutation;
}
