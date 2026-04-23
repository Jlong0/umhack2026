const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "in_progress", "processing", "running", "active"]);
const BLOCKED_STATUSES = new Set(["BLOCKED_HITL", "FAILED", "blocked", "failed", "error"]);
const APPROVAL_STATUSES = new Set(["awaiting_approval", "pending_human", "human_review"]);

function normalizeStatus(rawStatus, requiresApproval) {
  if (requiresApproval) {
    return "awaiting_approval";
  }

  const normalized = String(rawStatus ?? "pending")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["inprogress", "running", "active", "processing"].includes(normalized)) {
    return "IN_PROGRESS";
  }

  if (["done", "success", "resolved", "completed"].includes(normalized)) {
    return "COMPLETED";
  }

  if (["error", "failed"].includes(normalized)) {
    return "FAILED";
  }

  if (["blocked_hitl", "blocked"].includes(normalized)) {
    return "BLOCKED_HITL";
  }

  if (APPROVAL_STATUSES.has(normalized)) {
    return "awaiting_approval";
  }

  return normalized?.toUpperCase() || "PENDING";
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item));
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function inferNodeType(taskType, taskName) {
  const fingerprint = `${taskType} ${taskName}`.toLowerCase();

  if (/(document|passport|fomema|audit|parse)/.test(fingerprint)) {
    return "DocumentAudit";
  }

  if (/(compliance|permit|socso|check)/.test(fingerprint)) {
    return "ComplianceCheck";
  }

  if (/(fine|levy|penalty|calculate)/.test(fingerprint)) {
    return "CalculateFines";
  }

  if (/(myeg|gateway|payment|handoff)/.test(fingerprint)) {
    return "MyEGPending";
  }

  return "ComplianceCheck";
}

function toDisplayName(taskType, taskName) {
  if (taskName) {
    return String(taskName);
  }

  return String(taskType)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseFineExposure(rawTask, toolPayload, taskType) {
  const numericCandidates = [
    rawTask.fine_exposure,
    rawTask.fineExposure,
    rawTask.estimated_cost,
    rawTask.estimatedCost,
    toolPayload?.fine,
    toolPayload?.fine_amount,
    toolPayload?.amount,
  ];

  for (const candidate of numericCandidates) {
    if (candidate == null) {
      continue;
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    const parsed = Number(String(candidate).replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return /fine|levy/i.test(String(taskType)) ? 0 : null;
}

function getToolPayload(rawTask) {
  return rawTask.tool_payload ?? rawTask.toolPayload ?? null;
}

export function normalizeTask(rawTask, index, workerId) {
  const taskType =
    rawTask.task_type ??
    rawTask.taskType ??
    rawTask.node_type ??
    rawTask.nodeType ??
    `TASK_${index + 1}`;

  const displayName = toDisplayName(taskType, rawTask.task_name ?? rawTask.taskName);
  const dependsOn = toArray(rawTask.depends_on ?? rawTask.dependsOn);
  const aiMeta = rawTask.ai_metadata ?? rawTask.aiMetadata ?? {};
  const requiresApproval = Boolean(
    rawTask.requires_approval ?? rawTask.requiresApproval ?? aiMeta.requires_human_approval
  );
  const status = normalizeStatus(rawTask.status, requiresApproval);
  const toolPayload = getToolPayload(rawTask);

  return {
    id: String(rawTask.id ?? rawTask.task_id ?? `task-${index + 1}`),
    workerId: rawTask.worker_id ?? rawTask.workerId ?? workerId ?? null,
    taskType: String(taskType),
    taskName: displayName,
    status,
    dependsOn,
    dueDate: rawTask.due_date ?? rawTask.dueDate ?? null,
    authority: rawTask.authority ?? null,
    requiresApproval,
    nodeType: rawTask.node_type ?? rawTask.nodeType ?? inferNodeType(taskType, displayName),
    toolPayload,
    fineExposure: parseFineExposure(rawTask, toolPayload, taskType),
    confidenceScore: aiMeta.confidence_score ?? rawTask.confidence_score ?? null,
    reasoning: aiMeta.reasoning ?? rawTask.reasoning ?? null,
    raw: rawTask,
  };
}

export function normalizeTasksResponse(payload, workerId) {
  if (!payload) {
    return [];
  }

  const taskArray = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(taskArray)) {
    return [];
  }

  return taskArray.map((task, index) => normalizeTask(task, index, workerId));
}

export function isStatusActive(status) {
  return ACTIVE_STATUSES.has(String(status));
}

export function isStatusBlocked(status) {
  return BLOCKED_STATUSES.has(String(status));
}

export function isStatusAwaitingApproval(status) {
  return APPROVAL_STATUSES.has(String(status));
}

export function areDependenciesCompleted(task, tasks) {
  const byType = new Map(tasks.map((candidate) => [candidate.taskType, candidate]));
  return task.dependsOn.every((dependencyType) => byType.get(dependencyType)?.status === "COMPLETED");
}

export function findBlockingDependency(task, tasks) {
  if (!task?.dependsOn?.length) {
    return null;
  }

  const byType = new Map(tasks.map((candidate) => [candidate.taskType, candidate]));
  return task.dependsOn.find((dependencyType) => byType.get(dependencyType)?.status !== "COMPLETED") ?? null;
}

export function statusLabel(status) {
  return String(status).replace(/_/g, " ");
}
