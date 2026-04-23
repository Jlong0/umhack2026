import { useQuery } from "@tanstack/react-query";
import {
  scanAllWorkers,
  getWorkerAlerts,
  getCriticalAlerts,
  getExpiringPermits,
  getAlertDashboard,
} from "@/services/api";

export function useAlertDashboard() {
  return useQuery({
    queryKey: ["alertDashboard"],
    queryFn: getAlertDashboard,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useCriticalAlerts() {
  return useQuery({
    queryKey: ["criticalAlerts"],
    queryFn: getCriticalAlerts,
    staleTime: 5 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useExpiringPermits(days = 30) {
  return useQuery({
    queryKey: ["expiringPermits", days],
    queryFn: () => getExpiringPermits(days),
    staleTime: 30 * 1000,
  });
}

export function useWorkerAlerts(workerId) {
  return useQuery({
    queryKey: ["workerAlerts", workerId],
    queryFn: () => getWorkerAlerts(workerId),
    enabled: !!workerId,
    staleTime: 10 * 1000,
  });
}

export function useScanAllWorkers() {
  return useQuery({
    queryKey: ["scanWorkers"],
    queryFn: scanAllWorkers,
    staleTime: 60 * 1000,
    enabled: false, // Only runs when manually triggered
  });
}
