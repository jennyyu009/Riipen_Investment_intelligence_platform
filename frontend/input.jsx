import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Handshake,
  Home,
  Loader2,
  LogOut,
  Link,
  Mail,
  MessageCircle,
  Network,
  PieChart,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  TrendingUp,
  Upload,
  User,
  UsersRound,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const PAGE_STORAGE_KEY = "founderInvestorMatchPage";
const VALID_PAGES = new Set(["landing", "form", "dashboard"]);

const getInitialPage = () => {
  if (typeof window === "undefined") return "landing";
  const savedPage = window.localStorage.getItem(PAGE_STORAGE_KEY);
  return VALID_PAGES.has(savedPage) ? savedPage : "landing";
};

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
};

const demoMatches = [
  ["Deloitte Ventures", 98],
  ["OMERS Ventures", 98],
  ["Portage Ventures", 94],
  ["BDC Capital", 91],
  ["Inovia Capital", 89],
  ["Real Ventures", 86],
  ["Golden Ventures", 84],
  ["Relay Ventures", 82],
  ["Georgian", 79],
  ["Diagram Ventures", 77],
  ["Information Venture Partners", 74],
  ["StandUp Ventures", 72],
  ["ScaleUp Ventures", 69],
  ["Panache Ventures", 66],
  ["MaRS IAF", 63],
].map(([entityName, finalScore], index) => ({
  investor_id: index + 1,
  entity_name: entityName,
  final_score: finalScore,
}));

const recommendedInvestors = [
  {
    name: "Deloitte Ventures",
    score: 98,
    label: "Excellent Match",
    initials: "DV",
    bullets: [
      "Fintech thesis aligns with payments infrastructure and compliance workflows.",
      "Canadian portfolio concentration creates relevant market-pattern overlap.",
      "Seed-stage appetite matches the current fundraising window.",
    ],
    relationshipPaths: [],
  },
  {
    name: "OMERS Ventures",
    score: 98,
    label: "Excellent Match",
    initials: "OV",
    bullets: [
      "Strong history backing Canadian fintech and enterprise software teams.",
      "Network overlap through Toronto operators improves intro likelihood.",
      "Fund size and ownership targets fit a pre-seed to seed raise.",
    ],
    relationshipPaths: [],
  },
  {
    name: "Portage Ventures",
    score: 94,
    label: "Excellent Match",
    initials: "PV",
    bullets: [
      "Deep vertical focus on financial services modernization.",
      "Portfolio adjacency suggests practical go-to-market expertise.",
      "Warm path available through Canadian venture ecosystem contacts.",
    ],
    relationshipPaths: [],
  },
];

const relationshipReadiness = [
  { label: "LinkedIn connections", value: "Not linked", state: "Action needed" },
  { label: "Verified warm paths", value: "Pending", state: "Generate after sync" },
  { label: "Investor graph", value: "Ready", state: "15 targets loaded" },
];

const sectorBars = [
  { label: "Fintech", value: 92 },
  { label: "Enterprise SaaS", value: 68 },
  { label: "AI Infrastructure", value: 54 },
  { label: "Marketplaces", value: 31 },
];

const networkBars = [
  { label: "Strong", value: 62, color: "bg-emerald-500" },
  { label: "Medium", value: 28, color: "bg-blue-500" },
  { label: "Weak", value: 10, color: "bg-slate-300" },
];

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const slugifyId = (value, fallback) =>
  String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;

const normalizePathNode = (node, index, total) => {
  if (!node) return null;

  if (typeof node === "string") {
    return {
      id: slugifyId(`${node}-${index}`, `node-${index}`),
      label: node,
      type: index === 0 ? "founder" : index === total - 1 ? "investor" : "person",
    };
  }

  const label = node.label || node.name || node.title;
  if (!label) return null;

  return {
    id: node.id || slugifyId(`${label}-${index}`, `node-${index}`),
    label,
    type: node.type || (index === 0 ? "founder" : index === total - 1 ? "investor" : "unknown"),
    subtitle: node.subtitle || node.role || node.description,
  };
};

const normalizeRelationshipEntry = (entry, fallbackMatch = {}) => {
  if (!entry) return null;
  const sourcePath = entry.bestPath || entry.best_path || entry.path || entry.nodes || [];
  const bestPath = toArray(sourcePath)
    .map((node, index, nodes) => normalizePathNode(node, index, nodes.length))
    .filter(Boolean);

  if (!bestPath.length && !toArray(entry.edges).length) return null;

  const investorName =
    entry.investorName ||
    entry.investor_name ||
    entry.entity_name ||
    fallbackMatch.entity_name ||
    bestPath[bestPath.length - 1]?.label;

  const relationshipScore = hasValue(entry.relationshipScore)
    ? entry.relationshipScore
    : entry.relationship_score;

  return {
    investorName,
    matchScore: hasValue(entry.matchScore)
      ? entry.matchScore
      : hasValue(entry.match_score)
        ? entry.match_score
        : hasValue(entry.matching_score)
          ? entry.matching_score
          : fallbackMatch.final_score,
    relationshipScore,
    confidence: entry.confidence,
    bestPath,
    edges: toArray(entry.edges),
    evidence: toArray(entry.evidence).filter(Boolean),
  };
};

const normalizeRelationshipIntelligence = (payload, matches = []) => {
  const direct =
    payload?.relationshipIntelligence ||
    payload?.relationship_intelligence ||
    payload?.relationshipInsights ||
    payload?.relationship_insights ||
    payload?.relationship_results;

  const rawDirectEntries = Array.isArray(direct) ? direct : direct?.results || (direct ? [direct] : []);
  const directEntries = rawDirectEntries.flatMap((entry) => {
    const paths = toArray(entry.paths || entry.relationshipPaths || entry.relationship_paths);
    if (!paths.length) return [entry];
    return paths.map((path) => ({
      ...path,
      investorName: entry.investorName || entry.investor_name || entry.entity_name,
      matchScore: entry.matchScore || entry.match_score || entry.matching_score || entry.final_score,
    }));
  });
  const matchEntries = matches.flatMap((match) => {
    const relationshipData =
      match.relationshipIntelligence ||
      match.relationship_intelligence ||
      match.relationshipInsights ||
      match.relationship_insights;
    const relationshipEntries = Array.isArray(relationshipData)
      ? relationshipData
      : relationshipData?.results || (relationshipData ? [relationshipData] : []);

    const pathEntries = toArray(match.paths || match.relationshipPaths || match.relationship_paths).map((path) => ({
      ...path,
      investorName: match.entity_name,
      matchScore: match.final_score,
    }));

    return [...relationshipEntries, ...pathEntries].map((entry) => [entry, match]);
  });

  return [
    ...directEntries.map((entry) => [entry, matches.find((match) => match.entity_name === (entry.investorName || entry.investor_name))]),
    ...matchEntries,
  ]
    .map(([entry, match]) => normalizeRelationshipEntry(entry, match))
    .filter(Boolean);
};

export default function FounderIntakeForm() {
  const [page, setPage] = useState(getInitialPage);
  const [formData, setFormData] = useState({
    name: "",
    linkedinUrl: "",
    currentRole: "",
    email: "",
    startupName: "",
    websiteUrl: "",
    stage: "",
    industry: [],
    businessModel: [],
    fundraisingPreference: "",
    pitchDeck: null,
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingSource, setMatchingSource] = useState("demo");
  const [relationshipInsights, setRelationshipInsights] = useState([]);
  const [selectedRelationshipIndex, setSelectedRelationshipIndex] = useState(0);
  const [connectionDataFile, setConnectionDataFile] = useState(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const [deckBoost, setDeckBoost] = useState(0);
  const [deckError, setDeckError] = useState("");
  const [activePanel, setActivePanel] = useState(null);
  const [timeGreeting, setTimeGreeting] = useState(getTimeBasedGreeting);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Upload a founder and startup profile or paste notes here. I will keep the context attached to this dashboard section.",
    },
  ]);

  const stages = ["Pre-seed", "Seed", "Series A", "Growth (Series B/C)", "Scale (Series D+)"];
  const industryOptions = [
    "AI / Machine Learning",
    "Fintech",
    "HealthTech",
    "ClimateTech",
    "Enterprise SaaS",
    "Consumer Internet",
    "Marketplace",
    "Cybersecurity",
    "EdTech",
    "PropTech",
    "Logistics / Transportation",
    "Energy / CleanTech",
    "Biotech",
    "Web3 / Blockchain",
    "E-commerce",
    "Gaming",
  ];
  const businessModelOptions = [
    "B2B",
    "B2C",
    "B2B2C",
    "Marketplace",
    "SaaS",
    "Subscription",
    "Hardware",
    "Platform",
    "On-demand",
    "Data / AI",
    "Direct-to-Consumer",
    "Freemium",
  ];

  const marketSignals = [
    { label: "Warm intro fit", value: "87%", trend: "+12.4%" },
    { label: "Relevant investors", value: "142", trend: "+28" },
    { label: "Stage match", value: "Seed", trend: "Active" },
  ];

  const flowMetrics = ["ARR +31%", "CAC Payback 7.8m", "Seed Lead", "Fintech", "Warm Path", "Series A Ready"];

  useEffect(() => {
    window.localStorage.setItem(PAGE_STORAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeGreeting(getTimeBasedGreeting());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (page !== "dashboard") return undefined;

    let cancelled = false;
    const target = formData.pitchDeck ? 42 : 28;
    setDeckBoost(0);

    const interval = window.setInterval(() => {
      setDeckBoost((current) => {
        if (current >= target) {
          window.clearInterval(interval);
          return target;
        }
        return Math.min(target, current + 2);
      });
    }, 55);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [page, formData.pitchDeck]);

  useEffect(() => {
    if (page !== "dashboard") return undefined;

    let cancelled = false;

    const loadMatches = async () => {
      setMatchingLoading(true);
      setMatches([]);
      setRelationshipInsights([]);
      setSelectedRelationshipIndex(0);

      const startedAt = Date.now();

      try {
        const submitResponse = await fetch(`${API_BASE}/submit-founder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founder: {
              name: formData.name,
              linkedin_url: formData.linkedinUrl,
              current_role: formData.currentRole,
              email: formData.email,
            },
            startup: {
              startup_name: formData.startupName,
              website_url: formData.websiteUrl,
              stage: formData.stage,
              industry: formData.industry.join(", "),
              fundraising_preference: formData.fundraisingPreference,
              pitch_deck_url: formData.pitchDeck ? formData.pitchDeck.name : "",
            },
          }),
        });

        if (!submitResponse.ok) throw new Error("Founder submit failed");
        const submitData = await submitResponse.json();

        const matchResponse = await fetch(`${API_BASE}/match-investors/${submitData.startup_id}`, {
          method: "POST",
        });

        if (!matchResponse.ok) throw new Error("Matching failed");
        const matchData = await matchResponse.json();
        const topInvestors = (matchData.top_investors || []).slice(0, 15);

        const normalizedMatches = topInvestors.length
          ? topInvestors.map((investor, index) => ({
              ...investor,
              investor_id: investor.investor_id || index + 1,
              entity_name: investor.entity_name || `Investor ${index + 1}`,
              final_score: investor.final_score || investor.final_score_scaled || 0,
              relationshipIntelligence: investor.relationshipIntelligence || investor.relationship_intelligence,
              relationshipPaths: investor.relationshipPaths || investor.relationship_paths || investor.paths,
            }))
          : demoMatches;
        const normalizedRelationships = normalizeRelationshipIntelligence(matchData, normalizedMatches);

        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(normalizedMatches);
          setRelationshipInsights(normalizedRelationships);
          setSelectedRelationshipIndex(0);
          setMatchingSource(topInvestors.length ? "backend" : "demo");
          setMatchingLoading(false);
        }, remainingDelay);
      } catch (error) {
        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(demoMatches);
          setRelationshipInsights([]);
          setSelectedRelationshipIndex(0);
          setMatchingSource("demo");
          setMatchingLoading(false);
        }, remainingDelay);
      }
    };

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handlePitchDeckChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setDeckError("Pitch deck only accepts PDF files.");
      e.target.value = "";
      return;
    }

    setDeckError("");
    setFormData((prev) => ({
      ...prev,
      pitchDeck: file,
    }));
  };

  const openPanel = (panel) => {
    setActivePanel(panel);
    setChatMessages([
      {
        role: "assistant",
        text: `This chat is attached to ${panel.title}. Upload a founder and startup profile or add notes for this section.`,
      },
    ]);
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: chatInput.trim() },
      {
        role: "assistant",
        text: "Noted. This information is saved in the current dashboard context for review.",
      },
    ]);
    setChatInput("");
  };

  const handleClientFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: `Uploaded founder profile file: ${file.name}` },
      { role: "assistant", text: "File received. Add any notes you want attached to this section." },
    ]);
    e.target.value = "";
  };

  const handleLogout = () => {
    setPage("landing");
    setActivePanel(null);
    setSubmitError(false);
  };

  const isFormValid =
    formData.name.trim() &&
    formData.linkedinUrl.trim() &&
    formData.startupName.trim() &&
    formData.stage &&
    formData.industry.length > 0 &&
    formData.businessModel.length > 0 &&
    formData.fundraisingPreference.trim();

  const dashboardPanels = [
    {
      id: "matching",
      title: "Top 15 Matching Results",
      subtitle: "Investor list ranked by matching score.",
      icon: <BarChart3 size={20} />,
    },
    {
      id: "pitch",
      title: "Pitch Deck Upload",
      subtitle: "Upload one PDF deck to enrich matching.",
      icon: <FileText size={20} />,
    },
    {
      id: "relationship",
      title: "Relationship Intelligence",
      subtitle: "Upload connection data and generate warm paths.",
      icon: <Network size={20} />,
    },
    {
      id: "discovery",
      title: "Investor Exploration",
      subtitle: "Capture discovery feedback and investor notes.",
      icon: <MessageCircle size={20} />,
    },
  ];

  const dashboardUserName = formData.name || "Zhixin Yu";
  const displayedMatches = matches.length ? matches : demoMatches;
  const kpiCards = [
    { label: "Top Matches", value: "15", detail: matchingSource === "backend" ? "Live ranked investors" : "Ranked investor shortlist", icon: <Target size={19} /> },
    { label: "Pitch Deck Impact", value: `${deckBoost}%`, detail: formData.pitchDeck ? "Lift after deck upload" : "Projected matching lift", icon: <FileText size={19} /> },
    { label: "Warm Intro Paths", value: "24", detail: "Qualified relationship paths", icon: <Handshake size={19} /> },
    { label: "Network Connections", value: "87", detail: "Mapped venture contacts", icon: <UsersRound size={19} /> },
  ];

  const handleConnectionDataChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      setRelationshipError("Connection data must be a CSV file.");
      e.target.value = "";
      return;
    }

    setConnectionDataFile(file);
    setRelationshipLoading(true);
    setRelationshipError("");
    setRelationshipInsights([]);
    setSelectedRelationshipIndex(0);

    try {
      const connectionsCsv = await file.text();
      const payload = {
        founder_data: {
          name: formData.name || "Founder",
          linkedin_url: formData.linkedinUrl,
          current_role: formData.currentRole,
          email: formData.email,
        },
        top_investors: displayedMatches.slice(0, 15).map((investor) => ({
          ...investor,
          investor_name: investor.entity_name,
          matching_score: investor.final_score,
        })),
        connections_csv: connectionsCsv,
      };

      const response = await fetch(`${API_BASE}/relationship-intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail = "Relationship intelligence failed";
        try {
          const errorData = await response.json();
          detail = errorData.detail || detail;
        } catch (error) {
          detail = await response.text();
        }
        throw new Error(detail);
      }
      const data = await response.json();
      setRelationshipInsights(normalizeRelationshipIntelligence({ relationship_results: data }, displayedMatches));
    } catch (error) {
      setRelationshipInsights([]);
      setRelationshipError(
        error?.message
          ? `Unable to generate relationship intelligence: ${error.message}`
          : "Unable to generate relationship intelligence from the uploaded connection data.",
      );
    } finally {
      setRelationshipLoading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const missing = [];
    if (!formData.name.trim()) missing.push("Name");
    if (!formData.linkedinUrl.trim()) missing.push("LinkedIn URL");
    if (!formData.startupName.trim()) missing.push("Startup Name");
    if (!formData.stage) missing.push("Stage");
    if (!formData.industry.length) missing.push("Industry");
    if (!formData.businessModel.length) missing.push("Business Model");
    if (!formData.fundraisingPreference.trim()) missing.push("Fundraising Preferences");

    if (missing.length > 0) {
      setSubmitError(true);
      setMissingFields(missing);
      return;
    }

    setSubmitError(false);
    setMissingFields([]);
    setSubmitted(true);
    setPage("dashboard");
    console.log("Founder Intake Form Data:", formData);
  };

  const handleFormKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {page === "landing" ? (
        <div className="relative min-h-screen overflow-hidden bg-[#4d789b] px-4 py-6 text-white sm:px-8 lg:px-12">
          <style>{`
            @keyframes drift {
              0% { transform: translate3d(-8%, 0, 0); }
              50% { transform: translate3d(8%, -10px, 0); }
              100% { transform: translate3d(-8%, 0, 0); }
            }

            @keyframes tickerFlow {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }

            @keyframes pulseLine {
              0%, 100% { stroke-dashoffset: 420; opacity: 0.32; }
              50% { stroke-dashoffset: 0; opacity: 0.86; }
            }

            @keyframes floatPanel {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-14px); }
            }

            .landing-drift { animation: drift 18s ease-in-out infinite; }
            .landing-ticker { animation: tickerFlow 24s linear infinite; }
            .landing-flow-line { animation: pulseLine 5.8s ease-in-out infinite; }
            .landing-float-panel { animation: floatPanel 7s ease-in-out infinite; }
          `}</style>

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(166,197,220,0.55),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(37,82,119,0.45),transparent_30%),linear-gradient(135deg,#3f6687_0%,#5f8fb3_48%,#3f698e_100%)]" />
            <div className="landing-drift absolute -left-20 top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <div className="landing-drift absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-[#1f4f75]/40 blur-3xl [animation-delay:-7s]" />
            <div className="absolute inset-x-0 top-28 h-px bg-white/20" />
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
            <div className="absolute inset-y-0 right-1/4 w-px bg-white/10" />

            <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 1440 900" preserveAspectRatio="none">
              <path
                d="M-80 610 C 210 500, 310 725, 540 560 S 900 295, 1180 402 1530 315"
                fill="none"
                stroke="rgba(255,255,255,.42)"
                strokeWidth="2"
                strokeDasharray="14 16"
                className="landing-flow-line"
              />
              <path
                d="M-80 250 C 160 180, 300 370, 520 315 S 830 148, 1080 210 1540 135"
                fill="none"
                stroke="rgba(201,225,240,.52)"
                strokeWidth="2"
                strokeDasharray="10 18"
                className="landing-flow-line [animation-delay:-2.2s]"
              />
              <path
                d="M-100 765 C 190 690, 400 790, 650 670 S 940 520, 1160 585 1520 510"
                fill="none"
                stroke="rgba(17,62,96,.36)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="3 24"
                className="landing-flow-line [animation-delay:-3.8s]"
              />
            </svg>
          </div>

          <div className="relative mx-auto flex min-h-[calc(100vh-48px)] max-w-7xl flex-col">
            <header className="flex items-center justify-between border-b border-white/15 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/25 backdrop-blur-md">
                  <Network size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide">Founder Investor Match</p>
                  <p className="text-xs text-blue-50/70">Relationship intelligence</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-blue-50/80 shadow-lg backdrop-blur-md sm:flex">
                <Activity size={15} />
                Live capital signal
              </div>
            </header>

            <main className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.02fr_.98fr] lg:py-16">
              <section className="max-w-3xl">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-blue-50 shadow-lg backdrop-blur-md">
                  <Sparkles size={16} />
                  Investor Matching
                </div>
                <h1 className="text-5xl font-semibold leading-[0.98] tracking-tight text-white md:text-7xl">
                  Discover better fundraising through relationship intelligence.
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-blue-50/80">
                  Start with a focused founder intake, then explore investor fit, warm introduction paths, and capital signals in one relationship-driven workspace.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPage("form")}
                    className="group inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-base font-semibold text-[#345f82] shadow-2xl shadow-[#234f76]/30 transition hover:-translate-y-0.5 hover:bg-blue-50"
                  >
                    Start
                    <ArrowRight className="transition group-hover:translate-x-1" size={19} />
                  </button>
                  <div className="flex items-center gap-3 text-sm text-blue-50/80">
                    <ShieldCheck size={18} />
                    Founder data stays structured and private
                  </div>
                </div>
              </section>

              <section className="relative min-h-[520px]">
                <div className="landing-float-panel absolute right-0 top-3 w-full max-w-[520px] rounded-[30px] border border-white/20 bg-white/15 p-5 shadow-2xl shadow-[#183f63]/30 backdrop-blur-2xl">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-50/70">Capital readiness</p>
                      <h2 className="text-2xl font-semibold">Founder signal map</h2>
                    </div>
                    <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                      <TrendingUp size={24} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {marketSignals.map((signal) => (
                      <div key={signal.label} className="rounded-3xl border border-white/15 bg-white/10 p-4">
                        <p className="text-xs text-blue-50/70">{signal.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{signal.value}</p>
                        <p className="mt-1 text-xs font-medium text-cyan-100">{signal.trend}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-3xl border border-white/15 bg-[#244f73]/30 p-4">
                    <div className="mb-4 flex items-center justify-between text-sm text-blue-50/80">
                      <span>Investor affinity curve</span>
                      <span>Q3 pipeline</span>
                    </div>
                    <svg viewBox="0 0 520 170" className="h-36 w-full overflow-visible">
                      <defs>
                        <linearGradient id="curveFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,.46)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                        </linearGradient>
                      </defs>
                      <path d="M0 132 C65 112 88 68 145 82 C198 95 222 35 280 42 C350 50 352 123 420 91 C462 72 486 45 520 30 L520 170 L0 170 Z" fill="url(#curveFill)" />
                      <path d="M0 132 C65 112 88 68 145 82 C198 95 222 35 280 42 C350 50 352 123 420 91 C462 72 486 45 520 30" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
                      {[70, 145, 280, 420, 500].map((x, index) => (
                        <circle key={x} cx={x} cy={[108, 82, 42, 91, 38][index]} r="5" fill="#d9f0ff" />
                      ))}
                    </svg>
                  </div>
                </div>

                <div className="landing-float-panel absolute bottom-12 left-0 w-full max-w-[360px] rounded-[28px] border border-white/20 bg-white/15 p-5 shadow-2xl shadow-[#183f63]/25 backdrop-blur-2xl [animation-delay:-3s]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-50/70">Warm path quality</p>
                      <p className="mt-1 text-3xl font-semibold">4.8x</p>
                    </div>
                    <CircleDollarSign className="text-cyan-100" size={34} />
                  </div>
                  <div className="mt-5 grid grid-cols-5 items-end gap-2">
                    {[42, 64, 48, 86, 118].map((height, index) => (
                      <div key={height} className="rounded-full bg-white/20 p-1">
                        <div
                          className="rounded-full bg-gradient-to-t from-cyan-100 to-white"
                          style={{ height: `${height}px`, opacity: 0.72 + index * 0.06 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-0 right-4 w-[86%] overflow-hidden rounded-full border border-white/15 bg-[#264f73]/30 py-3 shadow-xl backdrop-blur-xl">
                  <div className="landing-ticker flex w-max gap-3 px-3">
                    {[...flowMetrics, ...flowMetrics].map((metric, index) => (
                      <span key={`${metric}-${index}`} className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-blue-50/90">
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      ) : page === "form" ? (
        <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                Investor Matching Intake
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                Fill in your founder profile
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
                Complete the form below and submit to enter your personalized dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6 rounded-3xl bg-white p-6 shadow-xl md:p-8">
              <section>
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <User size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Personal Information</h2>
                    <p className="text-sm text-slate-500">Founder profile and relationship data</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Name" name="name" value={formData.name} onChange={handleChange} required />
                  <Input label="Current Role" name="currentRole" value={formData.currentRole} onChange={handleChange} />
                  <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} icon={<Mail size={18} />} />
                  <Input label="LinkedIn URL" name="linkedinUrl" value={formData.linkedinUrl} onChange={handleChange} required icon={<Link size={18} />} placeholder="https://www.linkedin.com/in/..." />
                </div>
              </section>

              <Divider />

              <section>
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Startup Information</h2>
                    <p className="text-sm text-slate-500">Company stage, industry, and website</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Startup Name" name="startupName" value={formData.startupName} onChange={handleChange} required />
                  <Input label="Website URL" name="websiteUrl" value={formData.websiteUrl} onChange={handleChange} placeholder="https://yourstartup.com" />

                  <Select label="Stage" name="stage" value={formData.stage} onChange={handleChange} options={stages} required />
                  <MultiSelect
                    label="Industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    options={industryOptions}
                    required
                    placeholder="Select one or more industries"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MultiSelect
                    label="Business Model"
                    name="businessModel"
                    value={formData.businessModel}
                    onChange={handleChange}
                    options={businessModelOptions}
                    required
                    placeholder="Select business models"
                  />
                  <div />
                </div>
              </section>

              <Divider />

              <section>
                <h2 className="mb-4 text-xl font-semibold">Fundraising Preferences</h2>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  One sentence about your fundraising preferences <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="fundraisingPreference"
                  value={formData.fundraisingPreference}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="Example: We are looking for seed-stage investors with experience in AI infrastructure and enterprise SaaS."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </section>

              <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <Upload className="mx-auto mb-3" size={30} />
                <h2 className="text-lg font-semibold">Upload Your Pitch Deck</h2>
                <p className="mt-1 text-sm text-slate-500">PDF only</p>
                <input
                  type="file"
                  name="pitchDeck"
                  accept="application/pdf,.pdf"
                  onChange={handlePitchDeckChange}
                  className="mt-4 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
                {deckError && <p className="mt-3 text-sm font-medium text-rose-600">{deckError}</p>}
                {formData.pitchDeck && (
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Selected: {formData.pitchDeck.name}
                  </p>
                )}
              </section>

              {submitError && (
                <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
                  <p>Please complete all required fields before submitting.</p>
                  {missingFields.length > 0 && (
                    <p className="mt-2 text-sm text-rose-900">
                      Missing: {missingFields.join(", ")}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-slate-700"
              >
                Submit Founder Profile
              </button>

              {submitted && (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  Profile submitted successfully. Redirecting to dashboard...
                </div>
              )}
            </form>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-white text-slate-900 lg:pl-72">
          <style>{`
            @keyframes loadingSweep {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }

            .loading-sweep { animation: loadingSweep 1.4s ease-in-out infinite; }
          `}</style>

          <Sidebar
            userName={dashboardUserName}
            onLogout={handleLogout}
            onProfileClick={() => openPanel({ id: "profile", title: "Profile", subtitle: "Submitted form table." })}
            onMatchesClick={() => openPanel(dashboardPanels[0])}
            onPanelClick={openPanel}
            panels={dashboardPanels}
          />

          <main className="mx-auto w-full max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                  {matchingLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  {matchingLoading ? "Refreshing investor graph" : matchingSource === "backend" ? "Live ranking model" : "Demo ranking model"}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {timeGreeting}, {dashboardUserName} 👋
                </h1>
                <p className="mt-2 text-base text-slate-500">
                  Here&apos;s your fundraising intelligence overview.
                </p>
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700">
                <Upload size={17} />
                Upload New Deck
                <input type="file" accept="application/pdf,.pdf" onChange={handlePitchDeckChange} className="hidden" />
              </label>
            </header>

            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <KPICard key={card.label} {...card} />
              ))}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">Top 3 Recommended Investors</h2>
                      <p className="mt-1 text-sm text-slate-500">Prioritized by fit, relationship quality, and thesis overlap.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPanel(dashboardPanels[0])}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                      View all 15 matches <ArrowRight size={15} />
                    </button>
                  </div>

                  <div className="grid gap-4 2xl:grid-cols-3">
                    {recommendedInvestors.map((investor, index) => (
                      <InvestorCard
                        key={investor.name}
                        investor={investor}
                        rank={index + 1}
                        onViewDetails={() => openPanel({ id: "investor", title: investor.name, investor })}
                      />
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                  <AnalyticsCard title="Matching Overview" icon={<PieChart size={18} />}>
                    <div className="flex items-center gap-5">
                      <div className="relative h-28 w-28 shrink-0 rounded-full bg-[conic-gradient(#2563eb_0_62%,#22c55e_62%_84%,#e2e8f0_84%_100%)]">
                        <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white">
                          <span className="text-2xl font-semibold text-slate-950">74%</span>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm">
                        <LegendDot color="bg-blue-600" label="Excellent / Strong" value="62%" />
                        <LegendDot color="bg-emerald-500" label="Good" value="22%" />
                        <LegendDot color="bg-slate-300" label="Needs review" value="16%" />
                      </div>
                    </div>
                  </AnalyticsCard>

                  <AnalyticsCard title="Top Sectors" icon={<BarChart3 size={18} />}>
                    <div className="space-y-4">
                      {sectorBars.map((sector) => (
                        <HorizontalMetric key={sector.label} {...sector} />
                      ))}
                    </div>
                  </AnalyticsCard>

                  <AnalyticsCard title="Network Strength" icon={<Network size={18} />}>
                    <div className="space-y-4">
                      {networkBars.map((bar) => (
                        <HorizontalMetric key={bar.label} {...bar} />
                      ))}
                    </div>
                  </AnalyticsCard>
                </section>

                <AIInsightBanner />
              </div>

              <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
                <PitchDeckStatus
                  deckBoost={deckBoost}
                  pitchDeck={formData.pitchDeck}
                  deckError={deckError}
                  onPitchDeckChange={handlePitchDeckChange}
                />
                <RelationshipReadiness items={relationshipReadiness} />
              </aside>
            </div>
          </main>

          {activePanel && (
            <DashboardDrawer
              activePanel={activePanel}
              formData={formData}
              matches={displayedMatches}
              matchingLoading={matchingLoading}
              matchingSource={matchingSource}
              relationshipInsights={relationshipInsights}
              selectedRelationshipIndex={selectedRelationshipIndex}
              setSelectedRelationshipIndex={setSelectedRelationshipIndex}
              connectionDataFile={connectionDataFile}
              relationshipLoading={relationshipLoading}
              relationshipError={relationshipError}
              onConnectionDataChange={handleConnectionDataChange}
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleChatSend={handleChatSend}
              handleClientFile={handleClientFile}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar({ userName, onLogout, onProfileClick, onMatchesClick, onPanelClick, panels }) {
  const navItems = [
    { label: "Dashboard", icon: <Home size={18} />, action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { label: "Matches", icon: <Target size={18} />, action: onMatchesClick },
    {
      label: "Investor Discovery District",
      icon: <Building2 size={18} />,
      action: () =>
        onPanelClick({
          id: "investor-discovery-district",
          title: "Investor Discovery District",
          subtitle: "Investor discovery workspace.",
        }),
    },
    { label: "Network", icon: <Network size={18} />, action: () => onPanelClick(panels[2]) },
    { label: "Outreach", icon: <Send size={18} />, action: () => onPanelClick({ id: "outreach", title: "Outreach", subtitle: "Investor outreach workspace." }) },
    { label: "Settings", icon: <Settings size={18} />, action: () => onPanelClick({ id: "settings", title: "Settings", subtitle: "Account and dashboard preferences." }) },
  ];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#07182f] px-4 py-5 text-white lg:flex">
        <nav className="space-y-1 pt-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                item.label === "Dashboard"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/10 p-3">
          <button type="button" onClick={onProfileClick} className="flex w-full items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#07182f]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="text-xs text-slate-400">Founder account</p>
            </div>
          </button>
          <button type="button" onClick={onLogout} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white">
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Dashboard</p>
            <p className="text-xs text-slate-500">Investor intelligence</p>
          </div>
          <button type="button" onClick={onMatchesClick} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            Matches
          </button>
        </div>
      </div>
    </>
  );
}

function KPICard({ label, value, detail, icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">Live</span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function getPrimaryWarmIntroPath(investor) {
  const firstPath = investor?.relationshipPaths?.[0];
  if (!firstPath?.path?.length) return "";
  return firstPath.path.join(" -> ");
}

function InvestorCard({ investor, rank, onViewDetails }) {
  const primaryPath = getPrimaryWarmIntroPath(investor);

  return (
    <article className="flex min-h-full flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#07182f] text-xs font-bold text-white">
            #{rank}
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-blue-700">
            {investor.initials}
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">{investor.name}</h3>
            <p className="text-xs font-semibold text-emerald-700">{investor.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-blue-700">{investor.score}%</p>
          <p className="text-xs text-slate-500">match</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Fintech", "Canada", "Pre-seed / Seed"].map((tag) => (
          <span key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase text-slate-500">Why matched</p>
        <ul className="mt-3 space-y-2">
          {investor.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-sm leading-5 text-slate-600">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={15} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Warm Intro Path</p>
        {primaryPath ? (
          <p className="mt-2 text-sm leading-5 text-slate-700">{primaryPath}</p>
        ) : (
          <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-500">
            Link with your connections to generate warm intro path.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onViewDetails}
        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#07182f] px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        View Details
      </button>
    </article>
  );
}

function PitchDeckStatus({ deckBoost, pitchDeck, deckError, onPitchDeckChange }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-[#07182f] p-5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-100">Pitch Deck Status</p>
          <p className="mt-1 text-xs text-slate-400">{pitchDeck ? pitchDeck.name : "No active PDF uploaded"}</p>
        </div>
        <div className="rounded-lg bg-white/10 p-2 text-blue-100">
          <FileText size={19} />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-5xl font-semibold tracking-tight">{deckBoost}%</p>
        <p className="mt-1 text-sm font-semibold text-blue-100">matching lift</p>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(deckBoost, 100)}%` }} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        Upload your pitch deck to improve investor ranking quality.
      </p>

      <label className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#07182f] transition hover:bg-blue-50">
        <Upload size={17} />
        Upload PDF
        <input type="file" accept="application/pdf,.pdf" onChange={onPitchDeckChange} className="hidden" />
      </label>
      {deckError && <p className="mt-3 text-sm font-semibold text-rose-200">{deckError}</p>}
    </section>
  );
}

function RelationshipReadiness({ items }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Relationship Readiness</h2>
        <Network size={18} className="text-blue-700" />
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                {item.value}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.state}</p>
          </div>
        ))}
      </div>
      <button type="button" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
        <Link size={16} />
        Link connections
      </button>
    </section>
  );
}

function AnalyticsCard({ title, icon, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
      {children}
    </section>
  );
}

function AIInsightBanner() {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-700">AI Insight</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            Your strongest advantage is Toronto-based fintech network overlap.
          </p>
        </div>
      </div>
      <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100">
        View Full Insight <ArrowRight size={15} />
      </button>
    </section>
  );
}

function HorizontalMetric({ label, value, color = "bg-blue-600" }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-950">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function LegendDot({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function DashboardDrawer({
  activePanel,
  formData,
  matches,
  matchingLoading,
  matchingSource,
  relationshipInsights,
  selectedRelationshipIndex,
  setSelectedRelationshipIndex,
  connectionDataFile,
  relationshipLoading,
  relationshipError,
  onConnectionDataChange,
  chatMessages,
  chatInput,
  setChatInput,
  handleChatSend,
  handleClientFile,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">{activePanel.id}</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{activePanel.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {activePanel.id === "profile" ? (
          <ProfileTable formData={formData} />
        ) : activePanel.id === "matching" ? (
          <MatchesPanel matches={matches} matchingLoading={matchingLoading} matchingSource={matchingSource} />
        ) : activePanel.id === "investor" ? (
          <InvestorDetailPanel investor={activePanel.investor} />
        ) : activePanel.id === "relationship" ? (
          <RelationshipIntelligencePanel
            connectionDataFile={connectionDataFile}
            relationshipInsights={relationshipInsights}
            selectedRelationshipIndex={selectedRelationshipIndex}
            setSelectedRelationshipIndex={setSelectedRelationshipIndex}
            relationshipLoading={relationshipLoading}
            relationshipError={relationshipError}
            onConnectionDataChange={onConnectionDataChange}
          />
        ) : (
          <ChatWorkspace
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleChatSend={handleChatSend}
            handleClientFile={handleClientFile}
          />
        )}
      </div>
    </div>
  );
}

function ProfileTable({ formData }) {
  return (
    <div className="overflow-auto p-5">
      <div className="mb-4 flex items-center gap-2 text-blue-700">
        <TableProperties size={20} />
        <span className="font-semibold">Submitted form table</span>
      </div>
      <table className="w-full overflow-hidden rounded-lg text-left text-sm">
        <tbody className="divide-y divide-slate-100">
          {[
            ["Name", formData.name || "Zhixin Yu"],
            ["Current Role", formData.currentRole || "-"],
            ["Email", formData.email || "-"],
            ["LinkedIn URL", formData.linkedinUrl || "-"],
            ["Startup Name", formData.startupName || "-"],
            ["Website URL", formData.websiteUrl || "-"],
            ["Stage", formData.stage || "-"],
            ["Industry", formData.industry.join(", ") || "-"],
            ["Business Model", formData.businessModel.join(", ") || "-"],
            ["Fundraising Preferences", formData.fundraisingPreference || "-"],
            ["Pitch Deck", formData.pitchDeck?.name || "Not uploaded"],
          ].map(([label, value]) => (
            <tr key={label}>
              <th className="w-48 bg-slate-50 px-4 py-3 font-semibold text-slate-600">{label}</th>
              <td className="px-4 py-3 text-slate-900">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchesPanel({ matches, matchingLoading, matchingSource }) {
  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">Full Top 15 Matches</p>
          <p className="mt-1 text-sm text-slate-500">Complete shortlist kept outside the dashboard homepage.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          {matchingLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          {matchingLoading ? "Loading" : matchingSource === "backend" ? "Live results" : "Demo results"}
        </span>
      </div>

      {matchingLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
              <div className="loading-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-slate-50 to-transparent" />
              <div className="h-4 w-2/3 rounded-full bg-slate-200" />
              <div className="mt-3 h-3 w-1/4 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {matches.slice(0, 15).map((match, index) => {
            const score = Math.round(match.final_score || 0);
            const label = score >= 94 ? "Excellent Match" : score >= 85 ? "Strong Match" : score >= 75 ? "Good Match" : "Watchlist";
            return (
              <div key={`${match.entity_name}-${index}`} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[44px_minmax(0,1fr)_150px] sm:items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">#{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{match.entity_name}</p>
                  <p className="mt-1 text-sm text-slate-500">Fintech / Canada / Pre-seed / Seed</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-semibold text-blue-700">{score}%</p>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvestorDetailPanel({ investor }) {
  if (!investor) return null;
  const verifiedPaths = investor.relationshipPaths || [];

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-blue-50 text-sm font-black text-blue-700">
              {investor.initials}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{investor.name}</h3>
              <p className="text-sm font-semibold text-emerald-700">{investor.label}</p>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-blue-700">
            <p className="text-3xl font-semibold">{investor.score}%</p>
            <p className="text-xs font-semibold">match score</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {["Fintech", "Canada", "Pre-seed / Seed"].map((tag) => (
            <span key={tag} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_.9fr]">
          <div>
            <p className="text-sm font-semibold text-slate-950">Why matched</p>
            <ul className="mt-3 space-y-3">
              {investor.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-sm leading-6 text-slate-600">
                  <CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={16} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Warm Intro Path</p>
            {verifiedPaths.length > 0 ? (
              <div className="mt-3 space-y-3">
                {verifiedPaths.map((path, index) => (
                  <div key={`${path.path?.join("-")}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-950">
                      Path {index + 1}: {path.path.join(" -> ")}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Hops: {path.hops}</p>
                      <p>Relationship Score: {path.relationship_score}</p>
                      <p>Match Type: {path.match_type || "relationship path"}</p>
                      <p>Confidence: {path.confidence || "verified"}</p>
                    </div>
                    {path.evidence?.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {path.evidence.map((evidence) => (
                          <p key={evidence} className="text-xs leading-5 text-slate-500">
                            Evidence: {evidence}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white p-4">
                <div className="pointer-events-none select-none blur-[2px]">
                  <p className="text-sm font-semibold text-slate-400">
                    Path 1: You &gt; verified connection &gt; investor partner
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <p>Hops: pending</p>
                    <p>Relationship Score: pending</p>
                    <p>Match Type: verified graph path</p>
                    <p>Confidence: pending</p>
                  </div>
                </div>
                <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium leading-6 text-blue-700">
                  Link with your connections to generate warm intro path.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getRelationshipNodeStyles(type) {
  const styles = {
    founder: "border-blue-300 bg-blue-50 text-blue-800",
    person: "border-sky-200 bg-white text-slate-800",
    organization: "border-blue-100 bg-slate-50 text-slate-800",
    investor: "border-blue-600 bg-blue-600 text-white",
    portfolio: "border-slate-200 bg-white text-slate-700",
    unknown: "border-slate-200 bg-white text-slate-700",
  };

  return styles[type] || styles.unknown;
}

function getRelationshipNodeIcon(type) {
  if (type === "organization" || type === "investor" || type === "portfolio") return <Building2 size={18} />;
  if (type === "founder" || type === "person") return <User size={18} />;
  return <Network size={18} />;
}

function getConsecutiveEdge(edges, sourceNode, targetNode) {
  return edges.find((edge) => {
    const source = edge.source || edge.from;
    const target = edge.target || edge.to;
    return (
      (source === sourceNode.id || source === sourceNode.label) &&
      (target === targetNode.id || target === targetNode.label)
    );
  });
}

function getEdgeLabel(edge) {
  return edge?.relationshipType || edge?.relationship_type || edge?.rel_type || "";
}

function formatRelationshipScore(value) {
  if (!hasValue(value)) return "";
  return typeof value === "number" ? `${Math.round(value)}%` : value;
}

function RelationshipIntelligencePanel({
  connectionDataFile,
  relationshipInsights,
  selectedRelationshipIndex,
  setSelectedRelationshipIndex,
  relationshipLoading,
  relationshipError,
  onConnectionDataChange,
}) {
  const locked = !connectionDataFile;
  const hasRelationshipData = relationshipInsights.length > 0;
  const safeIndex = Math.min(selectedRelationshipIndex, Math.max(relationshipInsights.length - 1, 0));
  const selectedInsight = relationshipInsights[safeIndex];

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Relationship Intelligence</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">Founder & Startup Profile</h3>
            <p className="mt-1 text-sm text-slate-500">
              {connectionDataFile ? connectionDataFile.name : "Upload LinkedIn connection data to build relationship paths."}
            </p>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
            <Upload size={16} />
            Upload Connection Data
            <input type="file" accept=".csv,text/csv" onChange={onConnectionDataChange} className="hidden" />
          </label>
        </div>
        {relationshipError && <p className="mt-3 text-sm font-semibold text-rose-600">{relationshipError}</p>}

        <div className="relative mt-5">
          <div className={locked || relationshipLoading ? "pointer-events-none select-none blur-[3px]" : ""}>
            {hasRelationshipData ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <RelationshipGraph insight={selectedInsight} />
                <RelationshipSummaryPanel
                  insights={relationshipInsights}
                  selectedIndex={safeIndex}
                  selectedInsight={selectedInsight}
                  onSelect={setSelectedRelationshipIndex}
                />
              </div>
            ) : (
              <EmptyRelationshipState />
            )}
          </div>

          {(locked || relationshipLoading) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/75 px-4 backdrop-blur-[1px]">
              <div className="max-w-sm rounded-lg border border-blue-100 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  {relationshipLoading ? <Loader2 className="animate-spin" size={20} /> : <Network size={20} />}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {relationshipLoading
                    ? "Generating relationship intelligence from your connection data."
                    : "Upload your connection data to unlock relationship intelligence insights."}
                </p>
                {!relationshipLoading && (
                  <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
                    <Upload size={16} />
                    Upload Connection Data
                    <input type="file" accept=".csv,text/csv" onChange={onConnectionDataChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RelationshipGraph({ insight }) {
  const nodes = insight?.bestPath || [];
  const edges = insight?.edges || [];

  if (!nodes.length) return <EmptyRelationshipState compact />;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Network Visualization</p>
          <p className="mt-1 text-xs text-slate-500">Best path rendered from relationship data.</p>
        </div>
        <Network size={18} className="text-blue-700" />
      </div>

      <div className="min-h-[330px] overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex min-w-max items-center py-16">
          {nodes.map((node, index) => {
            const nextNode = nodes[index + 1];
            const edge = nextNode ? getConsecutiveEdge(edges, node, nextNode) : null;
            const edgeLabel = getEdgeLabel(edge);

            return (
              <React.Fragment key={node.id}>
                <div className={`flex w-36 shrink-0 flex-col items-center rounded-lg border p-3 text-center shadow-sm ${getRelationshipNodeStyles(node.type)}`}>
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 text-blue-700 ring-1 ring-black/5">
                    {getRelationshipNodeIcon(node.type)}
                  </div>
                  <p className="w-full text-sm font-semibold leading-5">{node.label}</p>
                  {node.subtitle && <p className="mt-1 w-full text-xs leading-4 opacity-70">{node.subtitle}</p>}
                  {node.type && <p className="mt-2 text-[11px] font-semibold uppercase opacity-60">{node.type}</p>}
                </div>

                {nextNode && (
                  <div className="relative flex w-24 shrink-0 items-center justify-center">
                    <div className="h-px w-full bg-blue-300" />
                    <ArrowRight className="absolute right-0 text-blue-500" size={16} />
                    {edgeLabel && (
                      <span className="absolute -top-7 max-w-24 truncate rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                        {edgeLabel}
                      </span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RelationshipSummaryPanel({ insights, selectedIndex, selectedInsight, onSelect }) {
  if (!selectedInsight) return <EmptyRelationshipState compact />;

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{selectedInsight.investorName || "Selected investor"}</p>
          <p className="mt-1 text-xs text-slate-500">Selected path summary</p>
        </div>
        {hasValue(selectedInsight.matchScore) && (
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            {formatRelationshipScore(selectedInsight.matchScore)}
          </span>
        )}
      </div>

      {insights.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {insights.map((insight, index) => (
            <button
              key={`${insight.investorName || "investor"}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                selectedIndex === index
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-blue-50 text-blue-700 ring-blue-100 hover:bg-blue-100"
              }`}
            >
              {insight.investorName || `Path ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3 text-sm">
        {hasValue(selectedInsight.relationshipScore) && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Relationship Score</p>
            <p className="mt-1 font-semibold text-slate-950">{formatRelationshipScore(selectedInsight.relationshipScore)}</p>
          </div>
        )}

        {selectedInsight.confidence && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Confidence</p>
            <p className="mt-1 font-semibold text-slate-950">{selectedInsight.confidence}</p>
          </div>
        )}

        {selectedInsight.bestPath?.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Best Path</p>
            <ol className="mt-2 space-y-2">
              {selectedInsight.bestPath.map((node, index) => (
                <li key={node.id} className="flex gap-2 text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {index + 1}
                  </span>
                  <span>{node.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {selectedInsight.evidence?.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Evidence & Signals</p>
            <ul className="mt-2 space-y-2">
              {selectedInsight.evidence.map((evidence) => (
                <li key={evidence} className="flex gap-2 leading-5 text-slate-600">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={15} />
                  <span>{evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button type="button" className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#07182f] px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
        <Send size={16} />
        Suggested outreach
      </button>
    </aside>
  );
}

function EmptyRelationshipState({ compact = false }) {
  return (
    <div className={`rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center ${compact ? "" : "min-h-[280px] flex flex-col items-center justify-center"}`}>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Network size={18} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950">No relationship path found yet.</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Try uploading LinkedIn connection data or adding founder network information.
      </p>
    </div>
  );
}

function ChatWorkspace({ chatMessages, chatInput, setChatInput, handleChatSend, handleClientFile }) {
  return (
    <>
      <div className="flex-1 space-y-4 overflow-auto bg-slate-50 p-5">
        {chatMessages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}>
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-4">
        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-blue-600 hover:text-blue-700">
          <Upload size={17} />
          Founder & Startup Profile
          <input type="file" accept=".pdf,.txt,.csv,.doc,.docx" onChange={handleClientFile} className="hidden" />
        </label>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleChatSend();
            }}
            placeholder="Message this section..."
            className="min-h-12 flex-1 rounded-lg border border-slate-200 px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <button type="button" onClick={handleChatSend} className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

function Input({ label, name, value, onChange, type = "text", required = false, placeholder = "", icon }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 ${icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}

function Select({ label, name, value, onChange, options, required = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      >
        <option value="">Select {label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiSelect({ label, name, value, onChange, options, required = false, placeholder = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (open && ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleOption = (option) => {
    const nextValue = value.includes(option)
      ? value.filter((item) => item !== option)
      : [...value, option];
    onChange({ target: { name, value: nextValue } });
  };

  return (
    <div className="relative" ref={ref}>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-14 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-400"
      >
        <div className="flex flex-wrap gap-2">
          {value.length > 0 ? (
            value.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {item}
              </span>
            ))
          ) : (
            <span className="text-slate-400">{placeholder || `Select ${label}`}</span>
          )}
        </div>
        <span className="text-slate-500">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          {options.map((option) => {
            const selected = value.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleOption(option)}
                className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span>{option}</span>
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-400"}`}>
                  {selected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-slate-100" />;
}
