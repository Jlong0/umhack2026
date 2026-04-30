import { createElement } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, ArrowRight, Cpu, Network, Lock } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px] animate-pulse [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[80px] animate-pulse [animation-delay:2s]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-indigo-400/40"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 py-12">
        {/* Logo & Branding */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-400">
              PermitIQ
            </p>
            <p className="text-xs text-slate-500">Agentic Compliance Platform</p>
          </div>
        </div>

        {/* Hero Title */}
        <h1 className="mb-3 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-center font-heading text-4xl font-bold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
          Foreign Worker
          <br />
          Compliance Engine
        </h1>
        <p className="mb-12 max-w-xl text-center text-base text-slate-400 sm:text-lg">
          AI-powered multi-agent system for automated permit processing,
          compliance monitoring, and workforce management.
        </p>

        {/* Feature pills */}
        <div className="mb-14 flex flex-wrap justify-center gap-3">
          {[
            { icon: Network, label: "Multi-Agent Orchestration" },
            { icon: Shield, label: "Real-time Compliance" },
            { icon: Lock, label: "HITL Governance" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur-sm"
            >
              {createElement(Icon, { className: "h-3.5 w-3.5 text-indigo-400" })}
              {label}
            </span>
          ))}
        </div>

        {/* Login Cards */}
        <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
          {/* Admin Card */}
          <button
            onClick={() => navigate("/login/admin")}
            className="group relative flex flex-col items-start gap-5 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-8 text-left backdrop-blur-md transition-all duration-300 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 ring-1 ring-indigo-500/20">
              <Shield className="h-7 w-7 text-indigo-400" />
            </div>
            <div className="relative">
              <h2 className="mb-1.5 font-heading text-xl font-semibold text-white">
                Admin Portal
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Access the full compliance dashboard, agent workflows, HITL
                controls, and analytics.
              </p>
            </div>
            <div className="relative mt-auto flex items-center gap-2 text-sm font-medium text-indigo-400 transition-all duration-200 group-hover:gap-3">
              Sign in with credentials
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </button>

          {/* Worker Card */}
          <button
            onClick={() => navigate("/login/worker")}
            className="group relative flex flex-col items-start gap-5 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-8 text-left backdrop-blur-md transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
              <Users className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="relative">
              <h2 className="mb-1.5 font-heading text-xl font-semibold text-white">
                Worker Portal
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Upload documents, check application status, and view your
                contracts.
              </p>
            </div>
            <div className="relative mt-auto flex items-center gap-2 text-sm font-medium text-emerald-400 transition-all duration-200 group-hover:gap-3">
              Select your Worker ID
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-center text-xs text-slate-600">
          Titan Core Technologies Sdn. Bhd. &middot; PermitIQ v1.0 &middot; UMHack
          2026
        </p>
      </div>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) scale(1); opacity: 0.4; }
          100% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
