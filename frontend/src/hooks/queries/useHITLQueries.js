import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  listHITLWorkers,
  resolveWorkerFields,
  setMedicalResult,
  listPendingInterrupts,
  getInterruptDetails,
  resolveInterrupt,
  getInterruptStatistics,
} from "@/services/api";

export function useHITLWorkers() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["hitlWorkers", selectedCompanyId],
    queryFn: () => listHITLWorkers(selectedCompanyId),
    refetchInterval: 10 * 1000,
    retry: false,
  });
}

export function useSetMedicalResult(workerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (result) => setMedicalResult(workerId, result),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hitlWorkers"] }),
  });
}

export function useResolveWorkerFields(workerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields) => resolveWorkerFields(workerId, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hitlWorkers"] }),
  });
}
import { useAuditLogStore } from "@/store/useAuditLogStore";

export function usePendingInterrupts() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["pendingInterrupts", selectedCompanyId],
    queryFn: () => listPendingInterrupts(selectedCompanyId),
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useInterruptDetails(workerId) {
  return useQuery({
    queryKey: ["interruptDetails", workerId],
    queryFn: () => getInterruptDetails(workerId),
    enabled: !!workerId,
    staleTime: 5 * 1000,
  });
}

export function useInterruptStats() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["interruptStats", selectedCompanyId],
    queryFn: () => getInterruptStatistics(selectedCompanyId),
    staleTime: 30 * 1000,
  });
}

export function useResolveInterrupt(workerId) {
  const queryClient = useQueryClient();
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  return useMutation({
    mutationFn: ({ decision, notes, modifiedData }) =>
      resolveInterrupt(workerId, decision, notes, modifiedData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pendingInterrupts"] });
      queryClient.invalidateQueries({ queryKey: ["interruptDetails", workerId] });
      queryClient.invalidateQueries({ queryKey: ["workflowStatus", workerId] });

      appendEntry({
        actor: "HUMAN",
        action: variables.decision === "approve" ? "HITL_APPROVED" : "HITL_REJECTED",
        workerId,
        details: variables.notes || `Decision: ${variables.decision}`,
        reversible: false,
      });
    },
  });
}
