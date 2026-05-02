import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User } from "lucide-react";
import { sendChatMessage } from "@/services/api";

const MODES = ["ASK STRATEGIST", "CHALLENGE ANALYSIS"];

export default function HITLChatbot({ workerId, targetAgent, onClose }) {
  const [mode, setMode] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const contextPrefix = `[Mode: ${MODES[mode]}] [Targeting: ${targetAgent}] [Worker: ${workerId}]\n`;
      const res = await sendChatMessage(contextPrefix + text, history);
      setMessages(prev => [...prev, { role: "assistant", content: res.reply || "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error contacting agent." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-semibold text-slate-100">AI Strategist</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
        {MODES.map((m, i) => (
          <button key={m} onClick={() => setMode(i)}
            className={`rounded px-2 py-1 text-[10px] font-bold tracking-wide transition ${i === mode ? "bg-amber-400 text-black" : "text-slate-500 hover:text-slate-300"}`}>
            {m}
          </button>
        ))}
        <span className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
          ⊙ {targetAgent}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 text-xs gap-1 pt-8">
            <Bot className="h-8 w-8 opacity-30" />
            <p className="font-medium text-slate-500">AI Strategist Ready</p>
            <p>Ask for analysis, or use "Challenge Analysis"<br />to question agent findings.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-indigo-600" : "bg-slate-700"}`}>
              {m.role === "user" ? <User className="h-3 w-3 text-white" /> : <Bot className="h-3 w-3 text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-slate-800 text-slate-200 rounded-tl-sm"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <div className="rounded-xl rounded-tl-sm bg-slate-800 px-3 py-2 text-xs text-slate-400">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask about this agent..."
            className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
          />
          <button onClick={send} disabled={!input.trim() || thinking}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400 text-black disabled:opacity-40">
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
