import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  scanAllWorkers,
  getWorkerAlerts,
  getCriticalAlerts,
  getExpiringPermits,
  getAlertDashboard,
} from "@/services/api";

export function useAlertDashboard() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["alertDashboard", selectedCompanyId],
    queryFn: () => getAlertDashboard(selectedCompanyId),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useCriticalAlerts() {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["criticalAlerts", selectedCompanyId],
    queryFn: () => getCriticalAlerts(selectedCompanyId),
    staleTime: 5 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useExpiringPermits(days = 30) {
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["expiringPermits", days, selectedCompanyId],
    queryFn: () => getExpiringPermits(days, selectedCompanyId),
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
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["scanWorkers", selectedCompanyId],
    queryFn: () => scanAllWorkers(selectedCompanyId),
    staleTime: 60 * 1000,
    enabled: false, // Only runs when manually triggered
  });
}
