import { create } from "zustand";

let _msgId = 0;
const nextId = () => `msg-${++_msgId}`;

export const useChatStore = create((set, get) => ({
  isOpen: false,
  isThinking: false,
  messages: [],

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setThinking: (v) => set({ isThinking: v }),

  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { id: nextId(), timestamp: Date.now(), ...msg }] })),

  // Replace the last assistant message (used to patch in tool results)
  updateLastAssistant: (patch) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], ...patch };
          break;
        }
      }
      return { messages: msgs };
    }),

  clear: () => set({ messages: [] }),

  // Convenience: history in the format the backend expects
  getHistory: () =>
    get()
      .messages.filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
}));
