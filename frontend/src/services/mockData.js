import { normalizeTasksResponse } from "@/services/taskAdapter";

const BASE_MOCK_TASKS = [
  {
    id: "doc-audit",
    task_type: "DocumentAudit",
    task_name: "Document Audit",
    status: "completed",
    depends_on: [],
  },
  {
    id: "compliance-check",
    task_type: "ComplianceCheck",
    task_name: "Compliance Check",
    status: "completed",
    depends_on: ["DocumentAudit"],
  },
  {
    id: "calculate-fines",
    task_type: "CalculateFines",
    task_name: "Calculate Fines",
    status: "in_progress",
    depends_on: ["ComplianceCheck"],
    requires_approval: true,
    tool_payload: {
      days_overstayed: 45,
      fine: "RM 1000",
      regulation: "Immigration Act 1959/63",
    },
    estimated_cost: 1000,
  },
  {
    id: "myeg-pending",
    task_type: "MyEGPending",
    task_name: "MyEG Payload Handoff",
    status: "blocked",
    depends_on: ["CalculateFines"],
    tool_payload: {
      levy_amount: "RM 590",
      processing_fee: "RM 35",
      worker_id: "demo-worker-001",
      channel: "MyEG",
    },
  },
];

export const DEFAULT_MYEG_PAYLOAD = {
  levy_amount: "RM 590",
  processing_fee: "RM 35",
  worker_id: "demo-worker-001",
  channel: "MyEG",
};

export function getFallbackTasks(workerId = "demo-worker-001") {
  const hydrated = BASE_MOCK_TASKS.map((task) => ({
    ...task,
    worker_id: workerId,
    tool_payload:
      task.task_type === "MyEGPending"
        ? { ...task.tool_payload, worker_id: workerId }
        : task.tool_payload,
  }));

  return normalizeTasksResponse({ worker_id: workerId, tasks: hydrated }, workerId);
}

export function getFallbackRumination(taskType = "CalculateFines") {
  return [
    `> Agent entering ${taskType} node...`,
    "> Ruminating: Passport expires in 45 days. Checking regulatory dependencies...",
    "> Dependency 'fomema_clearance' status resolved. Continuing workflow.",
    "> Action: waiting for human approval to resume graph execution.",
  ];
}
