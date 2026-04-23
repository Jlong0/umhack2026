import { create } from "zustand";
import { normalizeTasksResponse } from "@/services/taskAdapter";

const DEFAULT_MOCK_WORKER_ID = "demo-worker-001";

export const useWorkerStore = create((set) => ({
  workerId: null,
  jobId: null,
  documentId: null,
  parseJobStatus: "idle",
  parseStep: "Awaiting document upload.",
  parsedFields: {},
  documentPreviewUrl: null,
  tasks: [],
  taskSource: "api",
  ruminationLines: ["> Waiting for active task..."],

  setWorkerId: (workerId) => set({ workerId }),

  setJobContext: ({ jobId, documentId }) =>
    set({
      jobId,
      documentId,
      parseJobStatus: jobId ? "queued" : "idle",
      parseStep: jobId ? "Queued for extraction." : "Awaiting document upload.",
    }),

  setParseJobStatus: (parseJobStatus) => set({ parseJobStatus }),
  setParseStep: (parseStep) => set({ parseStep }),

  setParsedFields: (parsedFields) => set({ parsedFields: parsedFields || {} }),

  updateParsedField: (fieldKey, value) =>
    set((state) => ({
      parsedFields: {
        ...state.parsedFields,
        [fieldKey]: {
          ...(state.parsedFields[fieldKey] || {}),
          value,
        },
      },
    })),

  setDocumentPreviewUrl: (documentPreviewUrl) => set({ documentPreviewUrl }),

  setTasks: (tasks, source = "api") =>
    set((state) => ({
      tasks: normalizeTasksResponse(tasks, state.workerId || DEFAULT_MOCK_WORKER_ID),
      taskSource: source,
    })),

  applyTaskStatus: (taskId, nextStatus) =>
    set((state) => {
      const updated = state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatus,
              requiresApproval: false,
            }
          : task,
      );

      const byType = new Map(updated.map((task) => [task.taskType, task]));
      const unblocked = updated.map((task) => {
        if (task.status !== "blocked" || task.dependsOn.length === 0) {
          return task;
        }

        const allDepsCompleted = task.dependsOn.every((dependencyType) => byType.get(dependencyType)?.status === "completed");
        return allDepsCompleted ? { ...task, status: "pending" } : task;
      });

      return { tasks: unblocked };
    }),

  setRuminationLines: (ruminationLines) => set({ ruminationLines: ruminationLines || [] }),

  appendRuminationLine: (line) =>
    set((state) => ({
      ruminationLines: [...state.ruminationLines.slice(-7), line],
    })),

  resetIngestionState: () =>
    set({
      jobId: null,
      documentId: null,
      parseJobStatus: "idle",
      parseStep: "Awaiting document upload.",
      parsedFields: {},
      documentPreviewUrl: null,
    }),
}));
