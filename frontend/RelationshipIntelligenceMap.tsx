import React, { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Download,
  Expand,
  HelpCircle,
  Link2,
  Network,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";

type Investor = {
  id: number;
  name: string;
  initials: string;
  score: number;
  strength: "Strong" | "Medium";
  warmPaths: number;
  thesis: string;
};

type GraphNode = {
  id: string;
  label: string;
  subtitle: string;
  type: "founder" | "person" | "organization" | "investor" | "portfolio";
  x: number;
  y: number;
};

type RelationshipCard = {
  title: string;
  detail: string;
  confidence: "High";
  color: string;
};

const investors: Investor[] = [
  {
    id: 1,
    name: "Deloitte Ventures",
    initials: "DV",
    score: 80,
    strength: "Strong",
    warmPaths: 4,
    thesis: "Enterprise fintech, compliance, B2B workflows",
  },
  {
    id: 2,
    name: "OMERS Ventures",
    initials: "OV",
    score: 76,
    strength: "Strong",
    warmPaths: 3,
    thesis: "Canadian SaaS, fintech infrastructure",
  },
  {
    id: 3,
    name: "Portage Ventures",
    initials: "PV",
    score: 73,
    strength: "Medium",
    warmPaths: 2,
    thesis: "Financial services modernization",
  },
  {
    id: 4,
    name: "BDC Capital",
    initials: "BC",
    score: 69,
    strength: "Medium",
    warmPaths: 2,
    thesis: "Seed-stage Canadian technology companies",
  },
  {
    id: 5,
    name: "Inovia Capital",
    initials: "IC",
    score: 65,
    strength: "Medium",
    warmPaths: 1,
    thesis: "Applied AI and enterprise growth",
  },
];

const graphNodes: GraphNode[] = [
  {
    id: "founder",
    label: "Jenny / Latte",
    subtitle: "Founder",
    type: "founder",
    x: 7,
    y: 44,
  },
  {
    id: "ricardo",
    label: "Ricardo Lu",
    subtitle: "Audit Partner at Deloitte",
    type: "person",
    x: 27,
    y: 24,
  },
  {
    id: "deloitte",
    label: "Deloitte",
    subtitle: "Professional Services",
    type: "organization",
    x: 48,
    y: 44,
  },
  {
    id: "ventures",
    label: "Deloitte Ventures",
    subtitle: "Venture Capital",
    type: "investor",
    x: 67,
    y: 25,
  },
  {
    id: "portfolio",
    label: "Portfolio Examples",
    subtitle: "15+ portfolio companies",
    type: "portfolio",
    x: 84,
    y: 50,
  },
];

const relationships: RelationshipCard[] = [
  {
    title: "LinkedIn Connection",
    detail: "Since Feb 2022",
    confidence: "High",
    color: "border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    title: "Works at",
    detail: "Since 2014",
    confidence: "High",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    title: "Investment Arm",
    detail: "Deloitte to Deloitte Ventures",
    confidence: "High",
    color: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
];

const warmPathSteps = [
  "Jenny / Latte",
  "Ricardo Lu / Audit Partner at Deloitte",
  "Deloitte / Professional Services",
  "Deloitte Ventures / Venture Capital",
];

const evidence = [
  "Ricardo Lu lists Deloitte on LinkedIn",
  "Jenny and Ricardo are LinkedIn connections",
  "Deloitte Ventures is the investment arm of Deloitte",
  "Deloitte Ventures has invested in 15+ companies",
];

const nodeStyles: Record<GraphNode["type"], string> = {
  founder: "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-blue-500/30",
  person: "bg-blue-500 text-white shadow-blue-500/25",
  organization: "bg-emerald-500 text-white shadow-emerald-500/25",
  investor: "bg-slate-900 text-white shadow-slate-900/25",
  portfolio: "bg-orange-500 text-white shadow-orange-500/25",
};

const nodeIcons: Record<GraphNode["type"], React.ReactNode> = {
  founder: <Sparkles size={20} />,
  person: <UserRound size={20} />,
  organization: <Building2 size={20} />,
  investor: <TrendingUp size={20} />,
  portfolio: <UsersRound size={20} />,
};

function HeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton icon={<HelpCircle size={15} />} label="How it works" />
      <ActionButton icon={<Download size={15} />} label="Export" />
      <ActionButton icon={<Expand size={15} />} label="Expand" />
    </div>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function InvestorCard({
  investor,
  selected,
  onSelect,
}: {
  investor: Investor;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition ${
        selected
          ? "border-blue-300 bg-blue-50 shadow-blue-100"
          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          {investor.id}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-xs font-bold text-blue-700">
          {investor.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="truncate text-sm font-bold text-slate-900">{investor.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{investor.thesis}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
              {investor.score}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <MetricPill label="Strength" value={investor.strength} />
            <MetricPill label="Warm paths" value={String(investor.warmPaths)} />
          </div>
        </div>
      </div>
    </button>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Legend() {
  const nodes = [
    ["Founder", "bg-gradient-to-br from-blue-600 to-violet-600"],
    ["Person", "bg-blue-500"],
    ["Organization", "bg-emerald-500"],
    ["Investor", "bg-slate-900"],
    ["Portfolio", "bg-orange-500"],
  ];

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
      <h3 className="text-sm font-bold text-slate-900">Legend</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        {nodes.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${color}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-600">
        <LegendLine color="bg-blue-500" label="Direct LinkedIn connection" />
        <LegendLine color="bg-emerald-500" label="Dotted green: works at" dotted />
        <LegendLine color="bg-orange-500" label="Dotted orange: invested in" dotted />
        <LegendLine color="bg-violet-500" label="Purple arrow: warm intro path" />
      </div>
    </div>
  );
}

function LegendLine({ color, label, dotted = false }: { color: string; label: string; dotted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-0.5 w-8 ${color} ${dotted ? "border-t-2 border-dotted bg-transparent" : ""}`} />
      <span>{label}</span>
    </div>
  );
}

function RelationshipGraph() {
  return (
    <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <Network size={16} />
            Relationship Graph
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Why Deloitte Ventures is reachable</h2>
        </div>
        <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          4-step warm path
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_20%_20%,rgba(219,234,254,0.88),transparent_28%),linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="arrow-blue" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
                <path d="M0,0 L6,3 L0,6 Z" fill="#2563eb" />
              </marker>
              <marker id="arrow-purple" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="#7c3aed" />
              </marker>
            </defs>
            <path d="M16 52 C 21 37, 25 35, 31 32" fill="none" stroke="#2563eb" strokeWidth="0.8" markerEnd="url(#arrow-blue)" />
            <path d="M36 34 C 42 39, 45 43, 49 48" fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 2" />
            <path d="M57 47 C 62 39, 65 35, 69 32" fill="none" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2 2" />
            <path d="M75 34 C 81 42, 84 48, 88 55" fill="none" stroke="#f97316" strokeWidth="0.8" strokeDasharray="2 2" />
            <path
              d="M14 65 C 31 83, 52 78, 69 61 S 85 33, 91 31"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="0.9"
              strokeDasharray="1.5 1.5"
              markerEnd="url(#arrow-purple)"
            />
          </svg>

          {graphNodes.map((node) => (
            <GraphNodeCard key={node.id} node={node} />
          ))}

          <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-violet-100 bg-white/92 p-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                <ArrowRight size={13} />
                Warm intro path
              </span>
              <span>Jenny knows Ricardo directly, Ricardo anchors the Deloitte relationship, and Deloitte connects to its venture arm.</span>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-3">
          {relationships.map((relationship) => (
            <div key={relationship.title} className={`rounded-xl border p-4 shadow-sm ${relationship.color}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <h3 className="text-sm font-bold">{relationship.title}</h3>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">{relationship.detail}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Confidence: {relationship.confidence}
              </p>
            </div>
          ))}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">Reachability logic</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The strongest path combines a verified founder connection, employment evidence, and a corporate venture link.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function GraphNodeCard({ node }: { node: GraphNode }) {
  return (
    <div
      className="absolute flex w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center sm:w-[150px]"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg ${nodeStyles[node.type]}`}>
        {nodeIcons[node.type]}
      </div>
      <div className="mt-2 rounded-lg border border-white/80 bg-white/95 px-3 py-2 shadow-sm">
        <p className="text-xs font-bold leading-4 text-slate-950">{node.label}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{node.subtitle}</p>
      </div>
    </div>
  );
}

function DetailPanel({ investor }: { investor: Investor }) {
  return (
    <aside className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
          {investor.initials}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">{investor.name}</h2>
          <p className="text-sm text-slate-500">Type: Venture Capital</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailMetric label="Matching Score" value="80" />
        <DetailMetric label="Strength" value="Strong" />
        <DetailMetric label="Best Path Score" value="66/100" />
        <DetailMetric label="Reachability" value="High" />
      </div>

      <PanelSection title="Best Warm Introduction Path">
        <div className="space-y-3">
          {warmPathSteps.map((step, index) => (
            <div key={step} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </div>
              <div className="min-w-0 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold leading-5 text-slate-700">
                {step}
              </div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Evidence & Signals">
        <div className="space-y-2">
          {evidence.map((item) => (
            <div key={item} className="flex gap-2 text-sm leading-5 text-slate-600">
              <BadgeCheck className="mt-0.5 shrink-0 text-blue-600" size={16} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Suggested Next Step">
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
        >
          <Send size={16} />
          Request an introduction to Ricardo Lu
        </button>
        <p className="mt-3 text-center text-sm text-slate-500">Personalized outreach email drafted for you</p>
      </PanelSection>
    </aside>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="mb-3 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

export default function RelationshipIntelligenceMap() {
  const [selectedInvestorId, setSelectedInvestorId] = useState(1);
  const selectedInvestor = investors.find((investor) => investor.id === selectedInvestorId) || investors[0];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-blue-100 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                <Link2 size={14} />
                Relationship Intelligence
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Relationship Intelligence Map
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Visualize warm introduction paths between your startup and investors.
              </p>
            </div>
            <HeaderActions />
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)_350px]">
          <aside className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-950">Top Investor Matches</h2>
                <p className="mt-1 text-sm text-slate-500">Ranked by fit plus warm-path quality.</p>
              </div>
              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">5</span>
            </div>
            <div className="space-y-3">
              {investors.map((investor) => (
                <InvestorCard
                  key={investor.id}
                  investor={investor}
                  selected={investor.id === selectedInvestorId}
                  onSelect={() => setSelectedInvestorId(investor.id)}
                />
              ))}
            </div>
            <div className="mt-4">
              <Legend />
            </div>
          </aside>

          <RelationshipGraph />

          <DetailPanel investor={selectedInvestor} />
        </div>
      </div>
    </main>
  );
}
