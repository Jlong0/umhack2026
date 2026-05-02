import { create } from "zustand";
import { listCompanies, listWorkers } from "@/services/api";

function getWorkerId(worker) {
  return worker?.worker_id || worker?.id || "";
}

function getWorkerName(worker) {
  return (
    worker?.name ||
    worker?.full_name ||
    worker?.passport?.full_name ||
    worker?.master_name ||
    getWorkerId(worker)
  );
}

function getWorkerNationality(worker) {
  return worker?.nationality || worker?.passport?.nationality || "";
}

function getWorkerSector(worker) {
  return worker?.sector || worker?.general_information?.sector || "";
}

function normalizeWorker(docId, data) {
  const withId = { id: docId, ...data };
  const workerId = getWorkerId(withId) || docId;

  return {
    ...withId,
    worker_id: workerId,
    name: getWorkerName({ ...withId, worker_id: workerId }),
    nationality: getWorkerNationality(withId),
    sector: getWorkerSector(withId),
    company_id: withId.company_id || withId.companyId || "",
  };
}

function mergeWorkers(...workerGroups) {
  const byId = new Map();

  workerGroups.flat().forEach((worker) => {
    const workerId = getWorkerId(worker);
    if (!workerId) return;
    byId.set(workerId, { ...(byId.get(workerId) || {}), ...worker, worker_id: workerId });
  });

  return Array.from(byId.values()).sort((a, b) =>
    getWorkerName(a).localeCompare(getWorkerName(b)),
  );
}

export const useAuthStore = create((set) => ({
  // State
  user: null,
  role: null, // "admin" | "worker"
  isAuthenticated: false,
  companyList: [],
  selectedCompanyId: null,
  loginError: null,
  isLoading: false,
  workerList: [], // fetched from Firebase

  fetchCompanyList: async () => {
    set({ isLoading: true, loginError: null });
    try {
      const response = await listCompanies();
      const companies = (response?.companies || [])
        .sort((a, b) =>
          (a.company_name || a.name || a.id).localeCompare(b.company_name || b.name || b.id),
        );
      set({ companyList: companies, isLoading: false });
      return companies;
    } catch (err) {
      console.error("Failed to fetch company list from backend:", err);
      set({ loginError: "Failed to load companies. Is the backend running?", isLoading: false });
      return [];
    }
  },

  // Fetch workers from Firebase via the backend Admin SDK.
  fetchWorkerList: async () => {
    set({ isLoading: true });
    try {
      const response = await listWorkers();
      const rawWorkers = response?.workers || response?.data || [];
      const profileWorkers = rawWorkers.map((worker) => normalizeWorker(worker.worker_id || worker.id, worker));
      const workers = mergeWorkers(profileWorkers);
      set({ workerList: workers, isLoading: false });
      return workers;
    } catch (err) {
      console.error("Failed to fetch worker list from backend:", err);
      set({ isLoading: false });
      return [];
    }
  },

  // Admin portal entry: choose a company context; no Firebase Auth is used.
  loginAsAdmin: async (companyId) => {
    set({ isLoading: true, loginError: null });
    try {
      const response = await listCompanies();
      const companies = response?.companies || [];
      const companyData = companies.find((company) => {
        return company.id === companyId || company.company_id === companyId;
      });

      if (companyId && !companyData) {
        set({ loginError: "Selected company was not found in Firebase.", isLoading: false });
        return false;
      }

      set({
        user: {
          id: companyId || "all-companies",
          name: companyData.company_name || companyData.name || "Admin Portal",
          companyId: companyId || null,
        },
        role: "admin",
        selectedCompanyId: companyId || null,
        isAuthenticated: true,
        loginError: null,
        isLoading: false,
      });
      return true;
    } catch (err) {
      console.error("Admin portal error:", err);
      set({ loginError: "Failed to open admin portal. Is the backend running?", isLoading: false });
      return false;
    }
  },

  // Worker portal entry: verify worker_id + login_code credentials.
  loginAsWorker: async (workerId, loginCode) => {
    set({ isLoading: true, loginError: null });
    try {
      const response = await listWorkers();
      const workers = response?.workers || response?.data || [];
      const matchedWorker = workers.find((worker) => {
        return worker.worker_id === workerId || worker.id === workerId;
      });

      if (!matchedWorker) {
        set({ loginError: "Worker ID not found.", isLoading: false });
        return false;
      }

      if (matchedWorker.login_code && matchedWorker.login_code !== loginCode) {
        set({ loginError: "Incorrect login code. Please check your credentials.", isLoading: false });
        return false;
      }

      const workerData = normalizeWorker(matchedWorker.worker_id || matchedWorker.id, matchedWorker);

      set({
        user: {
          id: workerData.worker_id,
          name: workerData.name,
          nationality: workerData.nationality,
          sector: workerData.sector,
          companyId: workerData.company_id,
        },
        role: "worker",
        selectedCompanyId: workerData.company_id || null,
        isAuthenticated: true,
        loginError: null,
        isLoading: false,
      });
      return true;
    } catch (err) {
      console.error("Worker login error:", err);
      set({ loginError: "Failed to open worker portal. Is the backend running?", isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({
      user: null,
      role: null,
      selectedCompanyId: null,
      isAuthenticated: false,
      loginError: null,
    });
  },

  clearError: () => set({ loginError: null }),
}));
