import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadDocument, confirmDocument } from "@/services/api";
import { useAuditLogStore } from "@/store/useAuditLogStore";

export function useUploadDocument() {
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  return useMutation({
    mutationFn: ({ file, documentType }) => uploadDocument(file, documentType),
    onSuccess: (data) => {
      appendEntry({
        actor: "HUMAN",
        action: "DOC_UPLOADED",
        workerId: data?.worker_id || null,
        details: `Document uploaded: ${data?.document_id || "unknown"}`,
        reversible: false,
      });
    },
  });
}

export function useConfirmDocument() {
  const queryClient = useQueryClient();
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  return useMutation({
    mutationFn: ({ documentId, payload }) => confirmDocument(documentId, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workerTasks"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });

      appendEntry({
        actor: "HUMAN",
        action: "DOC_CONFIRMED",
        workerId: data?.worker_id || null,
        details: `Document ${variables.documentId} confirmed and pushed to pipeline`,
        reversible: false,
      });
    },
  });
}
