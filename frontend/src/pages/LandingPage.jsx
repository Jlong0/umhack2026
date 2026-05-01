import { createElement, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Users, ArrowRight, Cpu, Network, Lock, FileSearch, GitBranch,
  AlertTriangle, Calculator, FileSignature, ChevronDown, Zap, CheckCircle2,
  Bot, Eye, BarChart3, CalendarCheck, ClipboardList,
} from "lucide-react";

const FEATURES = [
  { icon: FileSearch, title: "Multimodal Document Ingestion", desc: "Upload passports, FOMEMA reports, SSM profiles — Gemini 2.5 Flash extracts structured fields with per-field confidence scores. Low-confidence values route to human review automatically." },
  { icon: Network, title: "Multi-Agent Orchestration", desc: "14-node LangGraph pipelines with supervisor routing maintain full worker state. Auditor, strategist, and filing agents share context and resume from failure without losing progress." },
  { icon: AlertTriangle, title: "Compliance Deadlock Detection", desc: "The strategist agent cross-checks permit, passport, FOMEMA, and housing obligations simultaneously — identifying circular dependencies a checklist tool would miss." },
  { icon: Calculator, title: "What-If Cost Simulator", desc: "Model MTLM levy tier changes before hiring and check EP salary compliance against pre/post-June 2026 thresholds. Turn reactive compliance into proactive planning." },
  { icon: GitBranch, title: "Dual-Sync Drift Detection", desc: "Compare internal records against government portal data to surface discrepancies before an audit catches them. Sync drift triggers instant alerts." },
  { icon: FileSignature, title: "End-to-End Contract Generation", desc: "AI maps extracted worker fields to PDF contract templates. Generate, review, and distribute employment contracts without leaving the platform." },
  { icon: ClipboardList, title: "HITL Approval Queues", desc: "Workflow interrupts, medical reviews, and contract sign-offs surface in a single queue. Humans retain final authority over every high-stakes decision." },
  { icon: CalendarCheck, title: "Worker Obligation Calendar", desc: "Per-worker calendar tracking passport renewals, permit renewals, and FOMEMA health screenings. Never miss a deadline again." },
];

const STATS = [
  { value: "13+", label: "Obligations tracked per worker" },
  { value: "14", label: "AI agent nodes across 2 graphs" },
  { value: "~4hrs", label: "Saved per worker per month" },
  { value: "RM 50K", label: "Max fine per missed deadline" },
];

const WORKFLOW_STEPS = [
  { icon: FileSearch, title: "Upload & Extract", desc: "Passport, FOMEMA, SSM — Gemini vision extracts every field with confidence scores." },
  { icon: Bot, title: "Agent Reasoning", desc: "Supervisor routes to auditor, strategist, and filing agents across all compliance gates." },
  { icon: Eye, title: "Human Review", desc: "HITL interrupts surface only for low-confidence fields, expiry alerts, or deadlocks." },
  { icon: CheckCircle2, title: "Cleared & Filed", desc: "Contracts generated, submissions prepared, renewal calendar populated." },
];

const PERSONAS = [
  { icon: Shield, role: "Compliance Officers", desc: "Upload a passport and have every field extracted, flagged, and the compliance workflow triggered — all from one action. See a live pipeline view across all regulatory gates.", accent: "blue" },
  { icon: BarChart3, role: "Operations Managers", desc: "Monitor workforce compliance health at a glance. Simulate MTLM levy impact before hiring, receive automated alerts when permits approach expiry.", accent: "amber" },
  { icon: Users, role: "Foreign Workers", desc: "Upload your own documents via a simple mobile-friendly interface. Track permit and contract status in real time — without depending on your employer.", accent: "emerald" },
];

const ACCENT_MAP = {
  blue: "border-blue-500/20 bg-blue-600/10 text-blue-500 dark:text-blue-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-500 dark:text-amber-400",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
};

export default function LandingPage() {
  const navigate = useNavigate();
  const featuresRef = useRef(null);
  const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-600/12 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-slate-700/15 blur-[100px] animate-pulse [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-blue-500/6 blur-[80px] animate-pulse [animation-delay:2s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute h-1 w-1 rounded-full bg-blue-400/30" style={{ left: `${10 + i * 11}%`, top: `${15 + (i % 4) * 20}%`, animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-20 lg:px-16">
        <div className="flex w-full max-w-7xl flex-col items-center">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400">PermitIQ</p>
              <p className="text-xs text-muted-foreground">Agentic Compliance Platform</p>
            </div>
          </div>

          <h1 className="mb-4 bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-center font-heading text-4xl font-bold tracking-tight text-transparent sm:text-5xl lg:text-6xl xl:text-7xl">
            Foreign Worker<br />Compliance Engine
          </h1>

          <p className="mb-6 max-w-3xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl">
            AI-powered multi-agent system that replaces manual compliance workflows for Malaysian SMEs — from document ingestion to permit renewal, deadline tracking to contract generation.
          </p>

          {/* Problem callout */}
          <div className="mb-10 w-full max-w-4xl rounded-xl border border-border bg-card/60 px-8 py-5 text-center backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              <span className="font-semibold text-amber-500">The problem:</span>{" "}
              Compliance officers track <span className="font-semibold text-foreground">13+ obligations per worker</span> across fragmented government portals (FWCMS, JTKSM, FOMEMA, MyEG). A single missed deadline →{" "}
              <span className="font-semibold text-red-500 dark:text-red-400">RM 10,000–50,000 fines</span> or criminal prosecution under the Immigration Act 1959/63.
            </p>
          </div>

          {/* Feature pills */}
          <div className="mb-12 flex flex-wrap justify-center gap-3">
            {[
              { icon: Network, label: "Multi-Agent Orchestration" },
              { icon: Shield, label: "Real-time Compliance" },
              { icon: Lock, label: "HITL Governance" },
              { icon: Zap, label: "Gemini 2.5 Flash Vision" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors duration-200 hover:border-blue-500/40 hover:text-foreground">
                {createElement(Icon, { className: "h-3.5 w-3.5 text-blue-500 dark:text-blue-400" })}
                {label}
              </span>
            ))}
          </div>

          {/* Login Cards — wider */}
          <div className="grid w-full max-w-5xl gap-6 sm:grid-cols-2">
            <button onClick={() => navigate("/login/admin")} className="group relative flex flex-col items-start gap-5 rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/60 p-8 text-left backdrop-blur-md transition-all duration-300 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/20">
                <Shield className="h-7 w-7 text-blue-500 dark:text-blue-400" />
              </div>
              <div className="relative">
                <h2 className="mb-1.5 font-heading text-xl font-semibold text-foreground">Admin Portal</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">Access the full compliance dashboard, agent workflows, HITL controls, and analytics.</p>
              </div>
              <div className="relative mt-auto flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 transition-all duration-200 group-hover:gap-3">
                Sign in with credentials
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </button>

            <button onClick={() => navigate("/login/worker")} className="group relative flex flex-col items-start gap-5 rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/60 p-8 text-left backdrop-blur-md transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
                <Users className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="relative">
                <h2 className="mb-1.5 font-heading text-xl font-semibold text-foreground">Worker Portal</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">Upload documents, check application status, and view your contracts.</p>
              </div>
              <div className="relative mt-auto flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-500 transition-all duration-200 group-hover:gap-3">
                Select your Worker ID
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </button>
          </div>

          <button onClick={scrollToFeatures} className="mt-14 flex flex-col items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-blue-500" aria-label="Scroll to features">
            <span className="text-xs font-medium uppercase tracking-widest">Explore features</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="relative z-10 border-y border-border bg-card/30 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4 lg:px-16">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-3xl font-bold text-foreground lg:text-4xl">{s.value}</p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section ref={featuresRef} className="relative z-10 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Platform Capabilities</p>
            <h2 className="mb-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">Everything you need to stay compliant</h2>
            <p className="mx-auto max-w-3xl text-base text-muted-foreground lg:text-lg">From document extraction to contract generation — PermitIQ handles the entire regulatory lifecycle so your compliance team can focus on what matters.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/30 hover:bg-card/70 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 dark:text-blue-400 transition-colors duration-200 group-hover:bg-blue-600/20">
                  {createElement(Icon, { className: "h-5 w-5" })}
                </div>
                <h3 className="mb-2 font-heading text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="relative z-10 border-y border-border bg-card/20 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Workflow</p>
            <h2 className="mb-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">How PermitIQ works</h2>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground">Four steps from document upload to full compliance clearance.</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="relative text-center">
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="absolute right-0 top-8 hidden h-px w-8 translate-x-full bg-gradient-to-r from-blue-500/40 to-transparent lg:block" />
                )}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/15 to-blue-500/5 ring-1 ring-blue-500/20">
                  <step.icon className="h-7 w-7 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="mb-1 inline-block rounded-full bg-blue-600/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Step {i + 1}</div>
                <h3 className="mb-1.5 font-heading text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PERSONAS ═══ */}
      <section className="relative z-10 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Who It's For</p>
            <h2 className="mb-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">Built for every stakeholder</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {PERSONAS.map(({ icon: Icon, role, desc, accent }) => (
              <div key={role} className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg ${ACCENT_MAP[accent]}`}>
                  {createElement(Icon, { className: "h-5 w-5" })}
                </div>
                <h3 className="mb-2 font-heading text-base font-semibold text-foreground">{role}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TECH STRIP ═══ */}
      <section className="relative z-10 border-y border-border bg-card/20 px-6 py-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Powered By</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {["React 18", "FastAPI", "LangGraph", "Gemini 2.5 Flash", "Firebase Firestore", "TanStack Query"].map((t) => (
              <span key={t} className="rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative z-10 px-6 py-24 lg:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">Ready to automate compliance?</h2>
          <p className="mb-8 text-base text-muted-foreground lg:text-lg">Stop tracking deadlines in spreadsheets. Let PermitIQ handle the regulatory complexity while you focus on growing your workforce.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate("/login/admin")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background">
              <Shield className="h-4 w-4" /> Open Admin Portal
            </button>
            <button onClick={() => navigate("/login/worker")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-8 py-3.5 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:border-emerald-500/50 hover:text-foreground hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background">
              <Users className="h-4 w-4" /> Worker Portal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/80">
              <Cpu className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">PermitIQ v1.0</span>
          </div>
          <p className="text-center text-xs text-muted-foreground">Titan Core Technologies Sdn. Bhd. &middot; UMHack 2026</p>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px) scale(1); opacity: 0.3; }
          100% { transform: translateY(-20px) scale(1.5); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
