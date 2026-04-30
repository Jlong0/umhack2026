/**
 * GraphVisualizerPage — Live Mermaid rendering of the multi-agent graph.
 *
 * Equivalent to `app.get_graph().draw_mermaid_png()` but rendered live
 * in the browser using the mermaid library. Shows all three graph layers:
 * Master, VDR Pipeline, and Compliance Pipeline.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Network, RefreshCw, Download, Maximize2 } from "lucide-react";

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001").replace(/\/+$/, "");

const TABS = [
  { key: "master", label: "Master Graph", description: "Full system architecture" },
  { key: "vdr", label: "VDR Pipeline", description: "Document → Validation → Assembly" },
  { key: "compliance", label: "Compliance Pipeline", description: "Supervisor → Agent routing" },
];

export default function GraphVisualizerPage() {
  const [graphs, setGraphs] = useState(null);
  const [activeTab, setActiveTab] = useState("master");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);
  const mermaidRef = useRef(null);

  // Lazy-load mermaid
  useEffect(() => {
    import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#6366f1",
          primaryTextColor: "#f1f5f9",
          primaryBorderColor: "#818cf8",
          lineColor: "#94a3b8",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "14px",
          nodeBorder: "#6366f1",
          mainBkg: "#1e293b",
          clusterBkg: "#0f172a",
          clusterBorder: "#334155",
          titleColor: "#e2e8f0",
          edgeLabelBackground: "#1e293b",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 16,
          nodeSpacing: 50,
          rankSpacing: 60,
        },
      });
      mermaidRef.current = mermaid;
    });
  }, []);

  // Fetch graph definitions
  const fetchGraphs = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/agents/graph-definition`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setGraphs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchGraphs(); }, [fetchGraphs]);

  // Render mermaid diagram when tab or data changes
  useEffect(() => {
    if (!graphs || !containerRef.current || !mermaidRef.current) return;

    const code =
      activeTab === "master" ? graphs.master_mermaid :
      activeTab === "vdr" ? graphs.vdr_mermaid :
      graphs.compliance_mermaid;

    if (!code) {
      containerRef.current.innerHTML = '<p class="text-gray-500 text-sm">No graph definition available</p>';
      return;
    }

    const id = `mermaid-${activeTab}-${Date.now()}`;
    mermaidRef.current
      .render(id, code)
      .then(({ svg }) => {
        containerRef.current.innerHTML = svg;
        // Make SVG responsive
        const svgEl = containerRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
          svgEl.style.minHeight = "400px";
        }
      })
      .catch(() => {
        containerRef.current.innerHTML =
          `<pre class="text-xs text-gray-400 whitespace-pre-wrap p-4 bg-gray-900 rounded-lg">${code}</pre>`;
      });
  }, [graphs, activeTab]);

  // Download SVG
  const handleDownload = () => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permitiq-${activeTab}-graph.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-6 ${fullscreen ? "fixed inset-0 z-50 bg-slate-950 p-6 overflow-auto" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <Network className="h-7 w-7 text-indigo-400" />
            Workflow Diagram
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Live multi-agent workflow topology — equivalent to <code className="text-indigo-400 text-xs">app.get_graph().draw_mermaid_png()</code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchGraphs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
          >
            <Download className="h-3.5 w-3.5" />
            SVG
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-gray-900/60 p-1 border border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <div>{tab.label}</div>
            <div className="text-[10px] mt-0.5 opacity-70">{tab.description}</div>
          </button>
        ))}
      </div>

      {/* Graph Container */}
      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-8 text-center">
          <p className="text-sm text-red-400">Failed to load graph definitions</p>
          <p className="text-xs text-red-400/60 mt-1">{error}</p>
          <button
            onClick={fetchGraphs}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-gray-900/50 p-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-sm text-gray-500">Loading graph definitions...</p>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 overflow-auto"
          style={{ minHeight: "500px" }}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-indigo-600" />
          <span>Entry Point</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-violet-600" />
          <span>Orchestrator</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-500" />
          <span>Router</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-500" />
          <span>Gov Portal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border border-gray-600" />
          <span>Agent Node</span>
        </div>
      </div>
    </div>
  );
}
