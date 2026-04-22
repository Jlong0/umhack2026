/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { getWorkerTasks } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";

export function useWorkerTasksPolling(workerId, options = {}) {
  const { enabled = true, intervalMs = 6000 } = options;
  const setTasks = useWorkerStore((state) => state.setTasks);

  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!workerId) {
      return;
    }

    setIsPolling(true);
    setError(null);

    try {
      const response = await getWorkerTasks(workerId, { allowMockFallback: true });
      setTasks(response.tasks, response.source);
      setLastUpdatedAt(new Date().toISOString());

      if (response.error) {
        setError(response.error);
      }
    } catch (pollError) {
      setError(pollError);
    } finally {
      setIsPolling(false);
    }
  }, [setTasks, workerId]);

  useEffect(() => {
    if (!enabled || !workerId) {
      return undefined;
    }

    refresh();
    const timer = window.setInterval(refresh, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, refresh, workerId]);

  return {
    isPolling,
    error,
    lastUpdatedAt,
    refresh,
  };
}
