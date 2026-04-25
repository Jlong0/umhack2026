import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateContracts,
  listContracts,
  getContractPdfUrl,
  uploadSignedContract,
  reviewContract,
} from "@/services/api";

export function useContracts(status, workerId) {
  return useQuery({
    queryKey: ["contracts", status, workerId],
    queryFn: () => listContracts(status, workerId),
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
