import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { uploadAttachment } from '../services/attachmentService';

export function useUploadAttachment(incidentId: string | null) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (file: File) => {
      if (!organization?.id) {
        throw new Error('Organization context is required');
      }
      if (!incidentId) {
        throw new Error('Incident ID is required');
      }
      return uploadAttachment(organization.id, incidentId, file);
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
