import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  listAllWorkflows,
  getWorkflowStatus,
  startComplianceWorkflow,
  resumeWorkflow,
  getComplianceGraph,
  updateJtksmDecision,
} from "@/services/api";

export function useAllWorkflows() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["allWorkflows", selectedCompanyId],
    queryFn: () => listAllWorkflows(selectedCompanyId),
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useJtksmDecision() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ workerId, decision, notes }) =>
      updateJtksmDecision(workerId, decision, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      qc.invalidateQueries({ queryKey: ["all-workflows"] });
    },
  });
}

export function useWorkflowStatus(workerId) {
  return useQuery({
    queryKey: ["workflowStatus", workerId],
    queryFn: () => getWorkflowStatus(workerId),
    enabled: !!workerId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useComplianceGraph(workerId) {
  return useQuery({
    queryKey: ["complianceGraph", workerId],
    queryFn: () => getComplianceGraph(workerId),
    enabled: !!workerId,
    staleTime: 30 * 1000,
  });
}

export function useStartWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workerId, workerData }) =>
      startComplianceWorkflow(workerId, workerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

export function useResumeWorkflow(workerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userDecision, additionalData }) =>
      resumeWorkflow(workerId, userDecision, additionalData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowStatus", workerId] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
