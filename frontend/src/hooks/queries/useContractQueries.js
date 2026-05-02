import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  generateContracts,
  listContracts,
  getContractPdfUrl,
  uploadSignedContract,
  reviewContract,
} from "@/services/api";

export function useContracts(status, workerId) {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["contracts", status, workerId, selectedCompanyId],
    queryFn: () => listContracts(status, workerId, selectedCompanyId),
    refetchInterval: 10000,
  });
}

export function useGenerateContracts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateContracts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useUploadSigned(contractId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => uploadSignedContract(contractId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useReviewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reviewContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useContractPdfUrl(contractId) {
  return useQuery({
    queryKey: ["contract-pdf", contractId],
    queryFn: () => getContractPdfUrl(contractId).then((d) => d.url),
    enabled: !!contractId,
  });
}
