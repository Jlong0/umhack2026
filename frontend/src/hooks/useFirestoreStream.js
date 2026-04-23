/**
 * Real-time Firestore stream listener for LangGraph events (PRD §5 / §6.3)
 *
 * Attaches onSnapshot to langgraph_streams/{workerId} and dispatches
 * UI triggers to Zustand stores.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { getFirestoreDb } from "@/services/firebase";
import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";
import { UI_TRIGGERS } from "@/types/stream";

/**
 * Hook to listen to a worker's LangGraph stream events in real-time.
 * @param {string|null} workerId - Worker ID to listen for, or null to disable
 * @returns {{ events: Array, latestEvent: Object|null, isConnected: boolean, error: Error|null }}
 */
export function useFirestoreStream(workerId) {
  const [events, setEvents] = useState([]);
  const [latestEvent, setLatestEvent] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Use refs for Zustand actions to avoid re-subscribe loops
  const pushBreachAlertRef = useRef(useUIStore.getState().pushBreachAlert);
  const openHITLDrawerRef = useRef(useUIStore.getState().openHITLDrawer);
  const appendEntryRef = useRef(useAuditLogStore.getState().appendEntry);

  useEffect(() => {
    pushBreachAlertRef.current = useUIStore.getState().pushBreachAlert;
    openHITLDrawerRef.current = useUIStore.getState().openHITLDrawer;
    appendEntryRef.current = useAuditLogStore.getState().appendEntry;
  });

  const handleEvent = useCallback(
    async (event) => {
      if (!event?.payload) return;

      const autonomyLevel = useUIStore.getState().autonomyLevel;

      // Log every AI event to the audit trail regardless of autonomy level
      appendEntryRef.current({
        actor: "AI",
        action: event.event_type || "AI_EVENT",
        workerId: event.payload.worker_id,
        details: event.payload.message,
        metadata: event.payload.computed_data || null,
      });

      // Autonomy enforcement (PRD §2):
      // 0 = Full Manual → suppress all AI-triggered UI actions
      // 33 = Suggest Only → show warnings but block auto-actions
      // 66 = Auto + Approval → route high-risk through IntentPreview
      // 100 = Full Auto → all triggers pass through
      if (autonomyLevel === 0) {
        // Full Manual: log only, no UI triggers
        return;
      }

      const trigger = event.payload.ui_trigger;

      if (trigger === UI_TRIGGERS.OPEN_WARNING_MODAL) {
        // Warnings always shown (autonomy >= 33)
        pushBreachAlertRef.current({
          worker_id: event.payload.worker_id,
          message: event.payload.message,
          computed_data: event.payload.computed_data,
          timestamp: event.timestamp,
        });
      } else if (trigger === UI_TRIGGERS.OPEN_HITL_DRAWER) {
        openHITLDrawerRef.current(event.payload.worker_id, null);
      } else if (trigger === UI_TRIGGERS.UPDATE_GATE_STATUS) {
        // Gate transition — invalidate workflow queries to refresh Kanban
        try {
          const { QueryClient } = await import("@tanstack/react-query");
          // Use window-level query client if available
          window.__permitiq_queryClient?.invalidateQueries({ queryKey: ["workflows"] });
          window.__permitiq_queryClient?.invalidateQueries({ queryKey: ["workflowStatus", event.payload.worker_id] });
        } catch { /* query client not available */ }
      } else if (trigger === UI_TRIGGERS.SHOW_CONFIDENCE_SCORE) {
        // Store confidence data for field highlighting
        appendEntryRef.current({
          actor: "AI",
          action: "CONFIDENCE_UPDATE",
          workerId: event.payload.worker_id,
          details: `Confidence score: ${event.payload.computed_data?.confidence_score}`,
          metadata: event.payload.computed_data,
        });
      } else if (trigger === UI_TRIGGERS.REFRESH_DASHBOARD) {
        // Force dashboard data refresh
        try {
          window.__permitiq_queryClient?.invalidateQueries({ queryKey: ["alertDashboard"] });
          window.__permitiq_queryClient?.invalidateQueries({ queryKey: ["pendingInterrupts"] });
        } catch { /* query client not available */ }
      }
    },
    [] // stable — no external deps, uses refs
  );

  useEffect(() => {
    if (!workerId) {
      setIsConnected(false);
      return;
    }

    let db;
    try {
      db = getFirestoreDb();
    } catch (err) {
      // Firebase not configured — degrade gracefully
      setError(new Error("Firebase not configured. Real-time updates disabled."));
      setIsConnected(false);
      return;
    }

    const docRef = doc(db, "langgraph_streams", workerId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setIsConnected(true);
        setError(null);

        if (snapshot.exists()) {
          const data = snapshot.data();
          const event = {
            event_type: data.event_type,
            timestamp: data.timestamp,
            payload: data.payload,
          };

          setLatestEvent(event);
          setEvents((prev) => [...prev.slice(-49), event]);
          handleEvent(event);
        }
      },
      (err) => {
        console.error("[FirestoreStream] Error:", err);
        setError(err);
        setIsConnected(false);
      }
    );

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [workerId, handleEvent]);

  return { events, latestEvent, isConnected, error };
}

/**
 * Hook to listen to the global stream for all workers (dashboard use).
 * Listens to the recent_events subcollection.
 */
export function useGlobalStream() {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const pushBreachAlert = useUIStore((s) => s.pushBreachAlert);
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  useEffect(() => {
    let db;
    try {
      db = getFirestoreDb();
    } catch {
      return;
    }

    const q = query(
      collection(db, "langgraph_events"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsConnected(true);
        const newEvents = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            newEvents.push(data);

            // Auto-push breach alerts
            if (data.event_type === "COMPLIANCE_BREACH") {
              pushBreachAlert({
                worker_id: data.payload?.worker_id,
                message: data.payload?.message,
                computed_data: data.payload?.computed_data,
                timestamp: data.timestamp,
              });
            }

            appendEntry({
              actor: "AI",
              action: data.event_type || "STREAM_EVENT",
              workerId: data.payload?.worker_id,
              details: data.payload?.message || "",
            });
          }
        });

        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
        }
      },
      (err) => {
        console.error("[GlobalStream] Error:", err);
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
  }, [pushBreachAlert, appendEntry]);

  return { events, isConnected };
}
