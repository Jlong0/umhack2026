import { normalizeTasksResponse } from "@/services/taskAdapter";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

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

export async function uploadDocument(file, documentType = "passport") {
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

