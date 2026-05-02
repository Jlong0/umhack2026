import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, ChevronDown, CheckCircle, XCircle, Loader2, Bot, User, Bell, QrCode } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { sendChatMessage, executeToolCall, triggerNotify, setupNotifyBot } from "@/services/api";

const SUGGESTIONS = [
  "Show critical alerts",
  "Start compliance check for Ahmad",
  "What's the levy for 5 manufacturing workers?",
  "List contracts awaiting signature",
];

// ── Message bubble ──────────────────────────────────────────────────────────

function ToolConfirmCard({ toolCall, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(toolCall);
    setLoading(false);
  };
  return (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-800 dark:bg-indigo-950">
      <p className="font-medium text-indigo-900 dark:text-indigo-100">Action required</p>
      <p className="mt-0.5 text-indigo-700 dark:text-indigo-300"
        dangerouslySetInnerHTML={{ __html: toolCall.preview.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
          Confirm
        </button>
        <button
          onClick={() => onCancel(toolCall.id)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-rose-300 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:text-rose-400 disabled:opacity-60 transition"
        >
          <XCircle className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message, onConfirm, onCancel }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-indigo-600" : "bg-muted"}`}>
        {isUser ? <User className="h-3.5 w-3.5 text-white" /> : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-indigo-600 text-white"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {message.content}
        </div>

        {/* Confirmation cards for pending tool calls */}
        {isAssistant &&
          message.toolCalls
            ?.filter((tc) => tc.needs_confirmation && !tc.confirmed && !tc.cancelled)
            .map((tc) => (
              <ToolConfirmCard
                key={tc.id}
                toolCall={tc}
                onConfirm={onConfirm}
                onCancel={onCancel}
              />
            ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AICommandConsole() {
  const { isOpen, isThinking, messages, toggleOpen, appendMessage, updateLastAssistant, setThinking, getHistory } =
    useChatStore();
  const [input, setInput] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isThinking) return;
    setInput("");

    appendMessage({ role: "user", content: trimmed });
    setThinking(true);

    try {
      const history = getHistory();
      const response = await sendChatMessage(trimmed, history);

      const assistantMsg = {
        role: "assistant",
        content: response.reply || "Done.",
        toolCalls: response.tool_calls || [],
        executedResults: response.executed_results || [],
      };
      appendMessage(assistantMsg);
    } catch (err) {
      appendMessage({
        role: "assistant",
        content: "Sorry, I couldn't reach the server. Please check that the backend is running.",
      });
    } finally {
      setThinking(false);
    }
  };

  const handleConfirmTool = async (toolCall) => {
    // Mark confirmed in the message
    updateLastAssistant({
      toolCalls: useChatStore
        .getState()
        .messages.findLast((m) => m.role === "assistant")
        ?.toolCalls?.map((tc) => (tc.id === toolCall.id ? { ...tc, confirmed: true } : tc)),
    });

    setThinking(true);
    try {
      const execResponse = await executeToolCall(toolCall.name, toolCall.args);
      // Feed result back to Gemini for a natural language summary
      const summary = await sendChatMessage("", getHistory(), {
        tool_name: toolCall.name,
        result: execResponse.result,
      });
      appendMessage({
        role: "assistant",
        content: summary.reply || "Action completed.",
        toolCalls: [],
        executedResults: [{ tool: toolCall.name, result: execResponse.result }],
      });
    } catch (err) {
      appendMessage({ role: "assistant", content: "The action failed. Please try again." });
    } finally {
      setThinking(false);
    }
  };

  const handleCancelTool = (toolId) => {
    updateLastAssistant({
      toolCalls: useChatStore
        .getState()
        .messages.findLast((m) => m.role === "assistant")
        ?.toolCalls?.map((tc) => (tc.id === toolId ? { ...tc, cancelled: true } : tc)),
    });
    appendMessage({ role: "assistant", content: "Cancelled. Let me know if there's anything else." });
  };

  const handleSetup = async () => {
    setSetupLoading(true);
    appendMessage({ role: "user", content: "Setup WhatsApp QR scan" });
    setThinking(true);
    try {
      const res = await setupNotifyBot();
      appendMessage({ role: "assistant", content: res.success ? "WhatsApp QR scanned successfully! The bot will now run headless automatically." : `Setup failed: ${res.message}` });
    } catch {
      appendMessage({ role: "assistant", content: "Setup failed. Make sure the backend server has a display available." });
    } finally {
      setThinking(false);
      setSetupLoading(false);
    }
  };

  const handleNotify = async () => {
    setNotifyLoading(true);
    appendMessage({ role: "user", content: "Notify workers via WhatsApp" });
    setThinking(true);
    try {
      const res = await triggerNotify();
      appendMessage({
        role: "assistant",
        content: `Notification agent queued messages for **${res.queued}** worker(s). The WhatsApp bot is sending them now in the background.`,
      });
    } catch {
      appendMessage({ role: "assistant", content: "Failed to trigger notifications. Please try again." });
    } finally {
      setThinking(false);
      setNotifyLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showSuggestions = messages.length === 0;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 transition hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40"
          aria-label="Open AI Command Console"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/20">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white">AI Command Console</span>
            </div>
            <button
              onClick={toggleOpen}
              className="rounded-lg p-1 text-indigo-200 hover:bg-white/10 hover:text-white transition"
              aria-label="Minimise"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "420px", minHeight: "240px" }}>
            {showSuggestions && (
              <div className="mb-4 space-y-1.5">
                <p className="text-center text-xs text-muted-foreground">
                  Ask me anything about your workers and compliance status.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100 transition dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onConfirm={handleConfirmTool}
                  onCancel={handleCancelTool}
                />
              ))}
              {isThinking && <ThinkingBubble />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a command in plain English…"
                rows={1}
                disabled={isThinking}
                className="flex-1 resize-none rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 disabled:opacity-50"
                style={{ maxHeight: "96px" }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                }}
              />
              <button
                onClick={handleSetup}
                disabled={setupLoading || isThinking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition"
                aria-label="Setup WhatsApp"
                title="One-time WhatsApp QR scan setup"
              >
                {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              </button>
              <button
                onClick={handleNotify}
                disabled={notifyLoading || isThinking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition"
                aria-label="Notify workers"
                title="Notify workers via WhatsApp"
              >
                {notifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isThinking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition"
                aria-label="Send"
              >
                {isThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
