import { useMutation, useQuery } from "@tanstack/react-query";
import {
  simulateMTLMLevy,
  simulateEPSalary,
  getMTLMTierStructure,
  getEPSalaryThresholds,
} from "@/services/api";

export function useMTLMTiers() {
  return useQuery({
    queryKey: ["mtlmTiers"],
    queryFn: getMTLMTierStructure,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEPSalaryThresholds() {
  return useQuery({
    queryKey: ["epSalaryThresholds"],
    queryFn: getEPSalaryThresholds,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSimulateMTLM() {
  return useMutation({
    mutationFn: ({ sector, currentForeignCount, currentLocalCount, newForeignWorkers }) =>
      simulateMTLMLevy(sector, currentForeignCount, currentLocalCount, newForeignWorkers),
  });
}

export function useSimulateEPSalary() {
  return useMutation({
    mutationFn: ({ category, currentSalaryRM, renewalDate }) =>
      simulateEPSalary(category, currentSalaryRM, renewalDate),
  });
}
