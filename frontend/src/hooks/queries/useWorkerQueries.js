import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkerTasks,
  patchWorkerTask,
} from "@/services/api";

export function useWorkerTasks(workerId) {
  return useQuery({
    queryKey: ["workerTasks", workerId],
    queryFn: () => getWorkerTasks(workerId),
    enabled: !!workerId,
    staleTime: 10 * 1000,
  });
}

export function usePatchWorkerTask(workerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }) => patchWorkerTask(workerId, taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workerTasks", workerId] });
    },
  });
}
