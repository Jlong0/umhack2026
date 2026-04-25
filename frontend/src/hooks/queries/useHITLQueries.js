import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listHITLWorkers,
  listPendingInterrupts,
  getInterruptDetails,
  resolveInterrupt,
  getInterruptStatistics,
} from "@/services/api";

export function useHITLWorkers() {
  return useQuery({
    queryKey: ["hitlWorkers"],
    queryFn: listHITLWorkers,
    refetchInterval: 10 * 1000,
  });
}
import { useAuditLogStore } from "@/store/useAuditLogStore";

export function usePendingInterrupts() {
  return useQuery({
    queryKey: ["pendingInterrupts"],
    queryFn: listPendingInterrupts,
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
  return useQuery({
    queryKey: ["interruptStats"],
    queryFn: getInterruptStatistics,
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
