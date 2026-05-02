import { normalizeTasksResponse } from "@/services/taskAdapter";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8001";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export class ApiError extends Error {
	constructor(message, status, data) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.data = data;
	}
}

function buildUrl(path) {
	if (!path.startsWith("/")) {
		return `${API_BASE_URL}/${path}`;
	}
	return `${API_BASE_URL}${path}`;
}

async function parseResponse(response) {
	const contentType = response.headers.get("content-type") || "";

	if (response.status === 204) {
		return null;
	}

	if (contentType.includes("application/json")) {
		return response.json();
	}

	const text = await response.text();
	return text ? { detail: text } : null;
}

async function apiRequest(path, options = {}) {
	const response = await fetch(buildUrl(path), {
		...options,
		headers: {
			...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
			...(options.headers || {}),
		},
	});

	const data = await parseResponse(response);

	if (!response.ok) {
		const detail = typeof data === "object" && data?.detail ? data.detail : "Request failed";
		throw new ApiError(detail, response.status, data);
	}

	return data;
}

export async function uploadDocument(file, documentType) {
	const body = new FormData();
	body.append("file", file);
	body.append("document_type", documentType);

	return apiRequest("/documents/upload", {
		method: "POST",
		body,
	});
}

export async function getParseJob(jobId) {
	return apiRequest(`/documents/jobs/${jobId}`, { method: "GET" });
}

export async function confirmDocument(documentId, payload) {
	return apiRequest(`/documents/${documentId}/confirm`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function createWorkerProfile(payload) {
	return apiRequest("/workers/create", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function getWorkerTasks(workerId) {
	const data = await apiRequest(`/workers/${workerId}/tasks`, { method: "GET" });
	return {
		workerId: data?.worker_id ?? workerId,
		tasks: normalizeTasksResponse(data, workerId),
		source: "api",
	};
}

export async function patchWorkerTask(workerId, taskId, payload) {
	return apiRequest(`/workers/${workerId}/tasks/${taskId}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}

// Agent Workflow APIs
export async function startComplianceWorkflow(workerId, workerData) {
	return apiRequest("/agents/workflows/start", {
		method: "POST",
		body: JSON.stringify({ worker_id: workerId, worker_data: workerData }),
	});
}

export async function getWorkflowStatus(workerId) {
	return apiRequest(`/agents/workflows/${workerId}/status`, { method: "GET" });
}

export async function resumeWorkflow(workerId, userDecision, additionalData = null) {
	return apiRequest(`/agents/workflows/${workerId}/resume`, {
		method: "POST",
		body: JSON.stringify({ user_decision: userDecision, additional_data: additionalData }),
	});
}

export async function getComplianceGraph(workerId) {
	return apiRequest(`/agents/workflows/${workerId}/graph`, { method: "GET" });
}

export async function listAllWorkflows(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/agents/workflows${qs}`, { method: "GET" });
}

// Alert APIs
export async function scanAllWorkers(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/alerts/scan${qs}`, { method: "GET" });
}

export async function getWorkerAlerts(workerId) {
	return apiRequest(`/alerts/worker/${workerId}`, { method: "GET" });
}

export async function getCriticalAlerts(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/alerts/critical${qs}`, { method: "GET" });
}

export async function getExpiringPermits(days = 30, companyId = null) {
	const qs = companyId ? `&company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/alerts/expiring?days=${days}${qs}`, { method: "GET" });
}

export async function getAlertDashboard(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/alerts/dashboard${qs}`, { method: "GET" });
}

// HITL APIs
export async function setMedicalResult(workerId, result) {
	return apiRequest(`/hitl/workers/${workerId}/medical-result`, {
		method: "PATCH",
		body: JSON.stringify({ result }),
	});
}

export async function listHITLWorkers(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/hitl/workers${qs}`, { method: "GET" });
}

export async function resolveWorkerFields(workerId, fields) {
	return apiRequest(`/hitl/workers/${workerId}/resolve-fields`, {
		method: "PATCH",
		body: JSON.stringify({ fields }),
	});
}

export async function listPendingInterrupts(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/hitl/interrupts${qs}`, { method: "GET" });
}

export async function getInterruptDetails(workerId) {
	return apiRequest(`/hitl/interrupts/${workerId}`, { method: "GET" });
}

export async function resolveInterrupt(workerId, decision, notes = null, modifiedData = null) {
	return apiRequest(`/hitl/interrupts/${workerId}/resolve`, {
		method: "POST",
		body: JSON.stringify({ decision, notes, modified_data: modifiedData }),
	});
}

export async function getInterruptStatistics(companyId = null) {
	const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
	return apiRequest(`/hitl/interrupts/stats${qs}`, { method: "GET" });
}

// Simulator APIs
export async function simulateMTLMLevy(sector, currentForeignCount, currentLocalCount, newForeignWorkers = 0) {
	return apiRequest("/simulator/mtlm-levy", {
		method: "POST",
		body: JSON.stringify({
			sector,
			current_foreign_count: currentForeignCount,
			current_local_count: currentLocalCount,
			new_foreign_workers: newForeignWorkers,
		}),
	});
}

export async function simulateEPSalary(category, currentSalaryRM, renewalDate) {
	return apiRequest("/simulator/ep-salary", {
		method: "POST",
		body: JSON.stringify({
			category,
			current_salary_rm: currentSalaryRM,
			renewal_date: renewalDate,
		}),
	});
}

export async function listWorkers() {
	return apiRequest("/workers", { method: "GET" });
}

export async function inviteWorker(payload) {
	return apiRequest("/workers/invite", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function getWorkerCredentials(workerId) {
	return apiRequest(`/workers/${workerId}/credentials`, { method: "GET" });
}

export async function assignAllLoginCodes() {
	return apiRequest("/workers/assign-login-codes", { method: "POST" });
}

export async function updateWorkerContact(workerId, payload) {
	return apiRequest(`/workers/${workerId}/update-contact`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}

export async function listWorkerObligations(workerId) {
	return apiRequest(`/workers/${workerId}/obligations`, { method: "GET" });
}

export async function listCompanies() {
	return apiRequest("/companies", { method: "GET" });
}

export async function getDocumentFields(documentType) {
	return apiRequest(`/documents/fields/${documentType}`, { method: "GET" });
}

export async function getMTLMTierStructure() {
	return apiRequest("/simulator/mtlm-tiers", { method: "GET" });
}

export async function getEPSalaryThresholds() {
	return apiRequest("/simulator/ep-salary-thresholds", { method: "GET" });
}

// Contract APIs
export async function generateContracts(templateFile) {
	const body = new FormData();
	body.append("template", templateFile);
	return apiRequest("/contracts/generate", { method: "POST", body });
}

export async function listContracts(status, workerId, companyId = null) {
	const params = new URLSearchParams();
	if (status) params.set("status", status);
	if (workerId) params.set("worker_id", workerId);
	if (companyId) params.set("company_id", companyId);
	const qs = params.toString() ? `?${params}` : "";
	return apiRequest(`/contracts${qs}`, { method: "GET" });
}

export async function getContractPdfUrl(contractId) {
	return apiRequest(`/contracts/${contractId}/pdf`, { method: "GET" });
}

export async function uploadSignedContract(contractId, file) {
	const body = new FormData();
	body.append("file", file);
	return apiRequest(`/contracts/${contractId}/upload-signed`, { method: "POST", body });
}

export async function reviewContract(contractId) {
	return apiRequest(`/contracts/${contractId}/review`, { method: "PATCH" });
}

export async function getDemoWorkerId() {
	return apiRequest("/contracts/demo-worker", { method: "GET" });
}

// Sync-check APIs
export async function getSyncCheck() {
	return apiRequest("/agents/sync-check", { method: "GET" });
}

// Chat / AI Command Console APIs
export async function sendChatMessage(message, history = [], pendingToolResult = null) {
	return apiRequest("/chat/command", {
		method: "POST",
		body: JSON.stringify({ message, history, pending_tool_result: pendingToolResult }),
	});
}

export async function executeToolCall(toolName, args = {}) {
	return apiRequest("/chat/execute-tool", {
		method: "POST",
		body: JSON.stringify({ tool_name: toolName, args }),
	});
}

export async function resolveSyncConflict(workerId, field) {
	return apiRequest(`/agents/sync-check/${workerId}/resolve?field=${encodeURIComponent(field)}`, { method: "POST" });
}

// Handoff APIs
export async function listPendingHandoffs() {
	return apiRequest("/agents/handoffs", { method: "GET" });
}

export async function confirmHandoff(handoffId) {
	return apiRequest(`/agents/handoffs/${handoffId}/confirm`, { method: "POST" });
}

export async function rejectHandoff(handoffId, notes = "") {
	return apiRequest(`/agents/handoffs/${handoffId}/reject?notes=${encodeURIComponent(notes)}`, { method: "POST" });
}

export async function updateJtksmDecision(workerId, decision, notes = "") {
  return apiRequest(`/workers/${workerId}/jtksm-decision`, {
    method: "PATCH",
    body: JSON.stringify({
      decision,
      notes,
    }),
  });
}


export async function getWorkerStatus(workerId) {
  return apiRequest(`/workers/${workerId}/status`);
}

export async function approveJTKSM(workerId) {
  return apiRequest(`/gates/${workerId}/approve-jtksm`, { method: "POST" });
}

export async function confirmArrival(workerId) {
  return apiRequest(`/gates/${workerId}/confirm-arrival`, { method: "POST" });
}

export async function approveFOMEMA(workerId, result = "suitable") {
  return apiRequest(`/gates/${workerId}/approve-fomema`, {
    method: "POST",
    body: JSON.stringify({ result }),
  });
}

export async function issuePermit(workerId) {
  return apiRequest(`/gates/${workerId}/issue-permit`, { method: "POST" });
}

export async function getVisaLetter(workerId) {
  return apiRequest(`/gates/${workerId}/visa-letter`);
}

export async function acknowledgeVisa(workerId) {
  return apiRequest(`/gates/${workerId}/acknowledge-visa`, { method: "POST" });
}
