/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { getParseJob } from "@/services/api";
import { useWorkerStore } from "@/store/useWorkerStore";

const EXTRACTION_STEPS = [
  "Indexing uploaded document...",
  "Running OCR and field extraction...",
  "Cross-checking confidence thresholds...",
  "Preparing HITL confirmation payload...",
];

export function useParseJobPolling(jobId) {
  const setParseJobStatus = useWorkerStore((state) => state.setParseJobStatus);
  const setParseStep = useWorkerStore((state) => state.setParseStep);
  const setParsedFields = useWorkerStore((state) => state.setParsedFields);

  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const stepText = useMemo(
    () => EXTRACTION_STEPS[Math.min(stepIndex, EXTRACTION_STEPS.length - 1)],
    [stepIndex],
  );

  useEffect(() => {
    if (!jobId) {
      setIsPolling(false);
      setStepIndex(0);
      setError(null);
      return;
    }

    let cancelled = false;
    let pollTimer;
    let failCount = 0;

    setIsPolling(true);
    setError(null);
    setStepIndex(0);
    setParseJobStatus("queued");
    setParseStep("Agent extracting data...");

    const stepTimer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, EXTRACTION_STEPS.length - 1));
    }, 1800);

    const stop = (status, finalStep) => {
      window.clearInterval(stepTimer);
      window.clearInterval(pollTimer);
      setParseJobStatus(status);
      setParseStep(finalStep);
      if (!cancelled) setIsPolling(false);
    };

    const pollOnce = async () => {
      try {
        const payload = await getParseJob(jobId);
        if (cancelled) return;
        failCount = 0;
        const status = String(payload?.status ?? "processing").toLowerCase();
        setParseJobStatus(status);
        if (status === "completed") {
          setParsedFields(payload?.result?.fields || {});
          stop("completed", "Extraction completed. Review and confirm the fields.");
        } else if (status === "failed") {
          setError(new Error(payload?.error || "Parse job failed."));
          stop("failed", "Extraction failed. Please retry upload.");
        }
      } catch (pollError) {
        if (cancelled) return;
        failCount += 1;
        if (failCount >= 3) {
          setError(pollError);
          stop("failed", "Network issue while polling parse status.");
        }
      }
    };

    pollOnce();
    pollTimer = window.setInterval(pollOnce, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
      window.clearInterval(pollTimer);
    };
  }, [jobId, setParseJobStatus, setParseStep, setParsedFields]);

  useEffect(() => {
    if (isPolling) {
      setParseStep(stepText);
    }
  }, [isPolling, setParseStep, stepText]);

  return {
    isPolling,
    stepText,
    error,
  };
}
