import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
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
import { apiFetch } from "./src/lib/api";

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

const fallbackMatches = [
  ["Early Stage Technology Fund", 98],
  ["North America Seed Partners", 94],
  ["Enterprise Software Ventures", 91],
  ["Founder First Capital", 88],
  ["Growth Technology Partners", 85],
  ["Innovation Seed Fund", 82],
  ["B2B Venture Partners", 79],
  ["Canadian Startup Capital", 76],
  ["Applied AI Ventures", 73],
  ["Digital Economy Fund", 70],
  ["Scaleup Capital Partners", 67],
  ["Technology Growth Fund", 64],
  ["Future Markets Ventures", 61],
  ["Operator Angel Network", 58],
  ["Emerging Companies Fund", 55],
].map(([entityName, finalScore], index) => ({
  investor_id: index + 1,
  entity_name: entityName,
  final_score: finalScore,
  match_reason: "Fallback match shown because the backend returned no ranked investors.",
}));

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

const getInvestorInitials = (name) =>
  String(name || "Investor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "IV";

const getMatchLabel = (score) => {
  const numericScore = Number(score || 0);
  if (numericScore >= 94) return "Excellent Match";
  if (numericScore >= 85) return "Strong Match";
  if (numericScore >= 75) return "Good Match";
  return "Watchlist";
};

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const toScore = (value) => {
  if (!hasValue(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : value;
};

const slugifyId = (value, fallback) =>
  String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || fallback;

const normalizeNodeType = (type, index, total) => {
  const normalizedType = String(type || "").toLowerCase();
  if (["founder", "person", "organization", "investor", "portfolio", "unknown"].includes(normalizedType)) {
    return normalizedType;
  }
  if (index === 0) return "founder";
  if (index === total - 1) return "investor";
  return "person";
};

const normalizePathNode = (node, index, total) => {
  if (!node) return null;

  if (typeof node === "string") {
    return {
      id: slugifyId(`${node}-${index}`, `node-${index}`),
      label: node,
      type: normalizeNodeType("", index, total),
    };
  }

  const label = node.label || node.name || node.title;
  if (!label) return null;

  return {
    id: node.id || slugifyId(`${label}-${index}`, `node-${index}`),
    label,
    type: normalizeNodeType(node.type, index, total),
    subtitle: node.subtitle || node.role || node.description,
    linkedinUrl: node.linkedinUrl || node.linkedin_url || node.linkedin,
  };
};

const getConfidenceLabel = (confidence, score) => {
  if (["High", "Medium", "Low"].includes(confidence)) return confidence;
  if (typeof score === "number") {
    if (score >= 75) return "High";
    if (score >= 45) return "Medium";
    return "Low";
  }
  if (confidence) return "High";
  return undefined;
};

const inferIntroducer = (nodes) => nodes.find((node, index) => index > 0 && index < nodes.length - 1 && node.type === "person") || nodes[1];

const getMatchLinkedInUrl = (match, contactName) => {
  if (!match) return "";
  const normalizedContact = String(contactName || "").trim().toLowerCase();
  if (normalizedContact && String(match.contact_1_name || "").trim().toLowerCase() === normalizedContact) {
    return match.contact_1_linkedin || "";
  }
  if (normalizedContact && String(match.contact_2_name || "").trim().toLowerCase() === normalizedContact) {
    return match.contact_2_linkedin || "";
  }
  return match.company_linkedin || "";
};

const normalizeRelationshipEdge = (edge, nodes, entry) => {
  if (!edge) return null;
  const source = edge.source || edge.from || edge.start || edge.source_id;
  const target = edge.target || edge.to || edge.end || edge.target_id;
  if (!source || !target) return null;

  return {
    source,
    target,
    relationshipType: edge.relationshipType || edge.relationship_type || edge.rel_type || edge.match_type || entry?.match_type,
    confidence: edge.confidence || entry?.confidence,
  };
};

const normalizeWarmIntro = (entry, investorContext = {}, pathIndex = 0) => {
  const sourcePath =
    entry.nodes ||
    entry.pathNodes ||
    entry.path_nodes ||
    entry.bestPath ||
    entry.best_path ||
    entry.path ||
    [];
  const nodes = toArray(sourcePath)
    .map((node, index, pathNodes) => normalizePathNode(node, index, pathNodes.length))
    .filter(Boolean);

  if (!nodes.length) return null;

  const explicitEdges = toArray(entry.edges || entry.pathEdges || entry.path_edges)
    .map((edge) => normalizeRelationshipEdge(edge, nodes, entry))
    .filter(Boolean);
  const edges = explicitEdges.length
    ? explicitEdges
    : nodes.slice(0, -1).map((node, index) => ({
        source: node.id,
        target: nodes[index + 1].id,
        relationshipType: entry.relationshipType || entry.relationship_type || entry.match_type,
        confidence: entry.confidence,
      }));
  const introducer = entry.introducerName || entry.introducer_name
    ? {
        label: entry.introducerName || entry.introducer_name,
        subtitle: entry.introducerRole || entry.introducer_role,
      }
    : inferIntroducer(nodes);
  const pathScore = hasValue(entry.pathScore)
    ? entry.pathScore
    : hasValue(entry.path_score)
      ? Math.round(entry.path_score)
      : entry.relationshipScore || entry.relationship_score || investorContext.relationshipScore;
  const targetContact = entry.targetContact || entry.target_contact || entry.contactName || entry.contact_name;
  const linkedinUrl =
    entry.linkedinUrl ||
    entry.linkedin_url ||
    entry.targetLinkedIn ||
    entry.target_linkedin ||
    getMatchLinkedInUrl(investorContext.fallbackMatch, targetContact);

  return {
    id: entry.id || slugifyId(`${investorContext.investorName}-${pathIndex}-${nodes.map((node) => node.label).join("-")}`, "warm-intro"),
    investorName: investorContext.investorName,
    targetContact,
    linkedinUrl,
    introducerName: introducer?.label,
    introducerRole: introducer?.subtitle,
    nodes,
    edges,
    pathNodes: nodes,
    pathEdges: edges,
    pathScore: toScore(pathScore),
    confidence: getConfidenceLabel(entry.confidence, pathScore),
    evidence: toArray(entry.evidence || investorContext.evidence).filter(Boolean),
    suggestedAction: entry.suggestedAction || entry.suggested_action,
  };
};

const normalizeInvestorRelationship = (entry, fallbackMatch = {}) => {
  if (!entry) return null;
  const rawPaths = toArray(entry.warmPaths || entry.warm_paths || entry.paths || entry.relationshipPaths || entry.relationship_paths);
  const pathEntries = rawPaths.length || !(entry.path || entry.nodes || entry.bestPath || entry.best_path)
    ? rawPaths
    : [entry];
  const investorName =
    entry.investorName ||
    entry.investor_name ||
    entry.entity_name ||
    fallbackMatch.entity_name ||
    pathEntries[0]?.investorName ||
    pathEntries[0]?.investor_name;

  if (!investorName) return null;

  const baseContext = {
    investorName,
    fallbackMatch,
    relationshipScore: entry.relationshipScore || entry.relationship_score,
    evidence: toArray(entry.evidence).filter(Boolean),
  };
  const warmPaths = pathEntries
    .map((path, index) => normalizeWarmIntro({ ...path, investorName }, baseContext, index))
    .filter(Boolean);
  const bestWarmPath = warmPaths[0];
  const relationshipScore = toScore(entry.relationshipScore || entry.relationship_score || bestWarmPath?.pathScore);

  return {
    investorName,
    matchScore: toScore(
      entry.matchScore ||
        entry.match_score ||
        entry.matching_score ||
        entry.final_score ||
        fallbackMatch.final_score,
    ),
    relationshipScore,
    confidence: entry.confidence || bestWarmPath?.confidence,
    warmPaths,
  };
};

const mergeRelationshipMatches = (matches) => {
  const grouped = new Map();

  matches.filter(Boolean).forEach((match) => {
    const key = match.investorName;
    if (!grouped.has(key)) {
      grouped.set(key, { ...match, warmPaths: [...(match.warmPaths || [])] });
      return;
    }

    const current = grouped.get(key);
    current.matchScore = current.matchScore ?? match.matchScore;
    current.relationshipScore = current.relationshipScore ?? match.relationshipScore;
    current.confidence = current.confidence ?? match.confidence;
    current.warmPaths = [...current.warmPaths, ...(match.warmPaths || [])];
  });

  return Array.from(grouped.values());
};

const getWarmIntroPathSummary = (warmIntro) => {
  const labels = (warmIntro?.nodes || warmIntro?.pathNodes || []).map((node) => node.label).filter(Boolean);
  return labels.join(" -> ");
};

const buildOutreachEmail = ({ formData, warmIntro, emailTone, fallbackInvestor }) => {
  const founderName = formData.name || "Founder";
  const startupName = formData.startupName || "our startup";
  const investorName = warmIntro?.investorName || fallbackInvestor || "the investor";
  const introducerName = warmIntro?.introducerName;
  const pathSummary = getWarmIntroPathSummary(warmIntro);
  const relationshipReason = pathSummary || warmIntro?.evidence?.[0] || "your relationship path";
  const startupDescription =
    formData.fundraisingPreference ||
    [formData.stage, formData.industry?.join(", ")].filter(Boolean).join(" ") ||
    "a company";
  const deckLine = formData.pitchDeck ? "\n\nI can also share our pitch deck for more context." : "";

  if (!introducerName) {
    return {
      to: warmIntro?.targetContact || investorName,
      introRequestTo: "",
      subject: `Introduction: ${startupName} x ${investorName}`,
      body: `Hi ${investorName},\n\nI'm ${founderName}, founder of ${startupName}. We are building ${startupDescription}.\n\nBased on your investment focus, I believe there may be a strong fit between our company and your portfolio.${deckLine}\n\nI'd love to share more and see if this could be relevant.\n\nBest,\n${founderName}`,
    };
  }

  return {
    to: warmIntro?.targetContact || investorName,
    introRequestTo: introducerName,
    subject: `Warm introduction to ${investorName}?`,
    body: `Hi ${introducerName},\n\nI hope you're doing well. I noticed that you may be connected to ${investorName} through ${relationshipReason}.\n\nI'm currently building ${startupName}, and based on their investment focus and our fundraising goals, I think ${investorName} could be a strong fit.${deckLine}\n\nWould you feel comfortable making a brief introduction?\n\nI'm happy to send over a short forwardable blurb.\n\nBest,\n${founderName}`,
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

  return mergeRelationshipMatches([
    ...directEntries.map((entry) => [entry, matches.find((match) => match.entity_name === (entry.investorName || entry.investor_name))]),
    ...matchEntries,
  ]
    .map(([entry, match]) => normalizeInvestorRelationship(entry, match))
    .filter(Boolean)
    .filter((match) => match.investorName));
};

export default function FounderIntakeForm() {
  const [page, setPage] = useState(getInitialPage);
  const [formData, setFormData] = useState({
    name: "",
    linkedinUrl: "",
    currentRole: "",
    email: "",
    location: "",
    education: "",
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
  const [matchingSource, setMatchingSource] = useState("fallback");
  const [relationshipInsights, setRelationshipInsights] = useState([]);
  const [selectedRelationshipIndex, setSelectedRelationshipIndex] = useState(0);
  const [selectedWarmPathIndex, setSelectedWarmPathIndex] = useState(0);
  const [connectionDataFile, setConnectionDataFile] = useState(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const [selectedWarmIntro, setSelectedWarmIntro] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [generatedEmail, setGeneratedEmail] = useState({ to: "", introRequestTo: "", subject: "", body: "" });
  const [emailTone, setEmailTone] = useState("Professional");
  const [emailNotice, setEmailNotice] = useState("");
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
      setSelectedWarmPathIndex(0);
      setSelectedWarmIntro(null);
      setSelectedInvestor(null);

      const startedAt = Date.now();

      try {
        const submitData = await apiFetch("/submit-founder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founder: {
              name: formData.name,
              linkedin_url: formData.linkedinUrl,
              current_role: formData.currentRole,
              email: formData.email,
              location: formData.location,
              education: formData.education,
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

        const matchData = await apiFetch(`/match-investors/${submitData.startup_id}`, {
          method: "POST",
        });
        console.info("[Matching] Backend response", matchData);

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
          : fallbackMatches;
        const normalizedRelationships = normalizeRelationshipIntelligence(matchData, normalizedMatches);

        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(normalizedMatches);
          setRelationshipInsights(normalizedRelationships);
          setSelectedRelationshipIndex(0);
          setSelectedWarmPathIndex(0);
          setSelectedWarmIntro(normalizedRelationships[0]?.warmPaths?.[0] || null);
          setSelectedInvestor(normalizedRelationships[0]?.investorName || null);
          setMatchingSource(topInvestors.length ? "backend" : "fallback");
          setMatchingLoading(false);
        }, remainingDelay);
      } catch (error) {
        console.error("[Matching] Backend request failed; showing fallback matches", error);
        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(fallbackMatches);
          setRelationshipInsights([]);
          setSelectedRelationshipIndex(0);
          setSelectedWarmPathIndex(0);
          setSelectedWarmIntro(null);
          setSelectedInvestor(null);
          setMatchingSource("fallback");
          setMatchingLoading(false);
        }, remainingDelay);
      }
    };

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    const selectedMatch = relationshipInsights[selectedRelationshipIndex];
    const safeWarmPathIndex = Math.min(selectedWarmPathIndex, Math.max((selectedMatch?.warmPaths?.length || 1) - 1, 0));
    const nextWarmIntro = selectedMatch?.warmPaths?.[safeWarmPathIndex] || null;
    if (safeWarmPathIndex !== selectedWarmPathIndex) {
      setSelectedWarmPathIndex(safeWarmPathIndex);
    }
    setSelectedWarmIntro(nextWarmIntro);
    setSelectedInvestor(selectedMatch?.investorName || nextWarmIntro?.investorName || null);
  }, [relationshipInsights, selectedRelationshipIndex, selectedWarmPathIndex]);

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

  const dashboardUserName = formData.name || "Founder";
  const displayedMatches = matches.length ? matches : fallbackMatches;
  const topInvestorCards = displayedMatches.slice(0, 3).map((match) => {
    const score = Math.round(match.final_score || match.final_score_scaled || 0);
    const location = [match.location_city, match.hq_country].filter(Boolean).join(", ");
    const details = [match.investor_type, location].filter(Boolean).join(" / ");
    return {
      name: match.entity_name || "Investor",
      score,
      label: getMatchLabel(score),
      initials: getInvestorInitials(match.entity_name),
      bullets: [
        match.match_reason || "Matched from the current founder and startup profile.",
        details || "Investor profile returned from the backend matching model.",
        hasValue(match.stage_score) || hasValue(match.industry_score)
          ? `Stage score: ${Math.round(match.stage_score || 0)} / Industry score: ${Math.round(match.industry_score || 0)}`
          : "Score details unavailable from backend.",
        hasValue(match.fundraising_score)
          ? `Fundraising Fit: ${Math.round(match.fundraising_score)}%`
          : "Fundraising Fit unavailable.",
      ],
      fundraisingScore: match.fundraising_score,
      linkedinMatches: match.linkedin_matches,
      linkedinMatchedCount: match.linkedin_matched_count || 0,
      linkedinContribution: match.linkedin_contribution || 0,
      relationshipPaths: match.relationshipPaths || match.relationship_paths || match.paths || [],
    };
  });
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
    setSelectedWarmPathIndex(0);
    setSelectedWarmIntro(null);
    setSelectedInvestor(null);

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

      const data = await apiFetch("/relationship-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const normalizedRelationships = normalizeRelationshipIntelligence({ relationship_results: data }, displayedMatches);
      setRelationshipInsights(normalizedRelationships);
      setSelectedWarmPathIndex(0);
      setSelectedWarmIntro(normalizedRelationships[0]?.warmPaths?.[0] || null);
      setSelectedInvestor(normalizedRelationships[0]?.investorName || null);
    } catch (error) {
      setRelationshipInsights([]);
      setSelectedWarmPathIndex(0);
      setSelectedWarmIntro(null);
      setSelectedInvestor(null);
      setRelationshipError("Unable to generate relationship intelligence. Please check that the backend service is available.");
    } finally {
      setRelationshipLoading(false);
      e.target.value = "";
    }
  };

  const selectWarmIntroByIndex = (index) => {
    const nextInsight = relationshipInsights[index];
    setSelectedRelationshipIndex(index);
    setSelectedWarmPathIndex(0);
    setSelectedWarmIntro(nextInsight?.warmPaths?.[0] || null);
    setSelectedInvestor(nextInsight?.investorName || null);
    setGeneratedEmail({ to: "", introRequestTo: "", subject: "", body: "" });
    setEmailNotice("");
  };

  const selectWarmPathByIndex = (index) => {
    const selectedMatch = relationshipInsights[selectedRelationshipIndex];
    const nextWarmPath = selectedMatch?.warmPaths?.[index] || null;
    setSelectedWarmPathIndex(index);
    setSelectedWarmIntro(nextWarmPath);
    setSelectedInvestor(selectedMatch?.investorName || nextWarmPath?.investorName || null);
    setGeneratedEmail({ to: "", introRequestTo: "", subject: "", body: "" });
    setEmailNotice("");
  };

  const getCurrentOutreachDraft = () => {
    if (generatedEmail.subject || generatedEmail.body) return generatedEmail;
    const email = buildOutreachEmail({
      formData,
      warmIntro: selectedWarmIntro,
      emailTone,
      fallbackInvestor: selectedInvestor,
    });
    setGeneratedEmail(email);
    return email;
  };

  const handleGenerateWarmIntroEmail = () => {
    const email = buildOutreachEmail({
      formData,
      warmIntro: selectedWarmIntro,
      emailTone,
      fallbackInvestor: selectedInvestor,
    });
    setGeneratedEmail(email);
    setEmailNotice("");
  };

  const handleCopyEmail = async () => {
    const draft = getCurrentOutreachDraft();
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    if (!draft.subject && !draft.body) return;
    try {
      await navigator.clipboard.writeText(text);
      setEmailNotice("Message copied to clipboard.");
    } catch (error) {
      setEmailNotice("Copy failed. Select the draft text and copy it manually.");
    }
  };

  const handleSendEmail = () => {
    const draft = getCurrentOutreachDraft();
    const subject = draft.subject || "Introduction";
    const body = draft.body || "";
    const to = draft.introRequestTo || draft.to || "";
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setEmailNotice("Email draft prepared.");
  };

  const handleSendLinkedIn = async () => {
    const linkedinUrl = selectedWarmIntro?.linkedinUrl;
    if (!linkedinUrl) {
      setEmailNotice("No LinkedIn URL available for this contact.");
      return;
    }

    let copied = false;
    const draft = getCurrentOutreachDraft();
    if (draft.body) {
      try {
        await navigator.clipboard.writeText(draft.body);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }
    window.open(linkedinUrl, "_blank", "noopener,noreferrer");
    setEmailNotice(copied ? "Message copied. LinkedIn profile opened." : "LinkedIn profile opened. Copy failed; select the draft text and copy it manually.");
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
                  <Input label="City and Country" name="location" value={formData.location} onChange={handleChange} placeholder="Toronto, Canada" />
                  <Input label="Education" name="education" value={formData.education} onChange={handleChange} placeholder="University and degree" />
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
                  {matchingLoading ? "Refreshing investor graph" : matchingSource === "backend" ? "Live ranking model" : "Fallback ranking"}
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

                  {topInvestorCards.length > 0 ? (
                    <div className="grid gap-4 2xl:grid-cols-3">
                      {topInvestorCards.map((investor, index) => (
                        <InvestorCard
                          key={investor.name}
                          investor={investor}
                          rank={index + 1}
                          onViewDetails={() => openPanel({ id: "investor", title: investor.name, investor })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                      No investor matches returned yet.
                    </div>
                  )}
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
              selectedWarmPathIndex={selectedWarmPathIndex}
              onWarmIntroSelect={selectWarmIntroByIndex}
              onWarmPathSelect={selectWarmPathByIndex}
              selectedWarmIntro={selectedWarmIntro}
              selectedInvestor={selectedInvestor}
              generatedEmail={generatedEmail}
              setGeneratedEmail={setGeneratedEmail}
              emailTone={emailTone}
              setEmailTone={setEmailTone}
              emailNotice={emailNotice}
              onGenerateWarmIntroEmail={handleGenerateWarmIntroEmail}
              onCopyEmail={handleCopyEmail}
              onSendEmail={handleSendEmail}
              onSendLinkedIn={handleSendLinkedIn}
              connectionDataFile={connectionDataFile}
              pitchDeckUploaded={Boolean(formData.pitchDeck)}
              relationshipLoading={relationshipLoading}
              relationshipError={relationshipError}
              onConnectionDataChange={handleConnectionDataChange}
              onPitchDeckChange={handlePitchDeckChange}
              onOpenOutreach={() => setActivePanel({ id: "outreach", title: "Outreach", subtitle: "Investor outreach workspace." })}
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
  selectedWarmPathIndex,
  onWarmIntroSelect,
  onWarmPathSelect,
  selectedWarmIntro,
  selectedInvestor,
  generatedEmail,
  setGeneratedEmail,
  emailTone,
  setEmailTone,
  emailNotice,
  onGenerateWarmIntroEmail,
  onCopyEmail,
  onSendEmail,
  onSendLinkedIn,
  connectionDataFile,
  pitchDeckUploaded,
  relationshipLoading,
  relationshipError,
  onConnectionDataChange,
  onPitchDeckChange,
  onOpenOutreach,
  chatMessages,
  chatInput,
  setChatInput,
  handleChatSend,
  handleClientFile,
  onClose,
}) {
  const fullScreenPanelIds = new Set(["relationship", "outreach", "investor-discovery-district"]);
  const isFullScreenPanel = fullScreenPanelIds.has(activePanel.id);

  return (
    <div className={`fixed inset-0 z-50 ${isFullScreenPanel ? "bg-white" : "bg-slate-950/35 p-4 backdrop-blur-sm"}`}>
      <div className={`flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl ${isFullScreenPanel ? "rounded-none" : "ml-auto max-w-3xl rounded-lg"}`}>
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
            matches={matches}
            connectionDataFile={connectionDataFile}
            relationshipInsights={relationshipInsights}
            selectedRelationshipIndex={selectedRelationshipIndex}
            selectedWarmPathIndex={selectedWarmPathIndex}
            selectedWarmIntro={selectedWarmIntro}
            onWarmIntroSelect={onWarmIntroSelect}
            onWarmPathSelect={onWarmPathSelect}
            relationshipLoading={relationshipLoading}
            relationshipError={relationshipError}
            onConnectionDataChange={onConnectionDataChange}
            onPitchDeckChange={onPitchDeckChange}
            onOpenOutreach={onOpenOutreach}
            pitchDeckUploaded={pitchDeckUploaded}
          />
        ) : activePanel.id === "outreach" ? (
          <OutreachPanel
            formData={formData}
            selectedWarmIntro={selectedWarmIntro}
            selectedInvestor={selectedInvestor}
            generatedEmail={generatedEmail}
            setGeneratedEmail={setGeneratedEmail}
            emailTone={emailTone}
            setEmailTone={setEmailTone}
            emailNotice={emailNotice}
            onGenerateWarmIntroEmail={onGenerateWarmIntroEmail}
            onCopyEmail={onCopyEmail}
            onSendEmail={onSendEmail}
            onSendLinkedIn={onSendLinkedIn}
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
            ["Name", formData.name || "-"],
            ["Current Role", formData.currentRole || "-"],
            ["Email", formData.email || "-"],
            ["LinkedIn URL", formData.linkedinUrl || "-"],
            ["Location", formData.location || "-"],
            ["Education", formData.education || "-"],
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
          {matchingLoading ? "Loading" : matchingSource === "backend" ? "Live results" : "Fallback results"}
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
                  <p className="mt-1 text-sm text-slate-500">
                    Fundraising Fit: {hasValue(match.fundraising_score) ? `${Math.round(match.fundraising_score)}%` : "Unavailable"}
                    {" / "}LinkedIn: {match.linkedin_matched_count || 0} / 4
                    {" / "}Contribution: {Number(match.linkedin_contribution || 0).toFixed(2)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatLinkedInMatches(match.linkedin_matches)}</p>
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

function formatLinkedInMatches(matches = {}) {
  return [
    ["Alumni", matches.alumni || matches.alumni_partial],
    ["Industry Experience", matches.industry_experience],
    ["Employer", matches.employer],
    ["Geography", matches.geography],
  ]
    .map(([label, matched]) => `${matched ? "✓" : "✗"} ${label}`)
    .join(" · ");
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
            <LinkedInMatchSummary
              matches={investor.linkedinMatches}
              matchedCount={investor.linkedinMatchedCount}
              contribution={investor.linkedinContribution}
            />
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

function LinkedInMatchSummary({ matches = {}, matchedCount = 0, contribution = 0 }) {
  const conditions = [
    ["Alumni", Boolean(matches.alumni || matches.alumni_partial)],
    ["Industry Experience", Boolean(matches.industry_experience)],
    ["Employer", Boolean(matches.employer)],
    ["Geography", Boolean(matches.geography)],
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">LinkedIn Match Summary</p>
      <div className="mt-3 space-y-2">
        {conditions.map(([label, matched]) => (
          <p key={label} className={`text-sm font-medium ${matched ? "text-emerald-700" : "text-slate-500"}`}>
            {matched ? "✓" : "✗"} {label}
            {label === "Alumni" && matches.alumni_partial ? " (university only)" : ""}
          </p>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">Matched: {matchedCount} / 4</p>
      <p className="mt-1 text-xs text-slate-500">
        Final score contribution: {Number(contribution || 0).toFixed(2)}%
      </p>
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
  selectedWarmPathIndex,
  selectedWarmIntro,
  onWarmIntroSelect,
  onWarmPathSelect,
  relationshipLoading,
  relationshipError,
  onConnectionDataChange,
  onPitchDeckChange,
  onOpenOutreach,
  pitchDeckUploaded,
}) {
  const locked = !pitchDeckUploaded;
  const hasRelationshipData = relationshipInsights.length > 0;
  const safeIndex = Math.min(selectedRelationshipIndex, Math.max(relationshipInsights.length - 1, 0));
  const selectedInsight = relationshipInsights[safeIndex];
  const selectedWarmPaths = selectedInsight?.warmPaths || [];
  const safeWarmPathIndex = Math.min(selectedWarmPathIndex, Math.max(selectedWarmPaths.length - 1, 0));
  const selectedPath = selectedWarmPaths[safeWarmPathIndex] || selectedWarmIntro || null;

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
              <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
                <RelationshipInvestorList
                  investors={relationshipInsights}
                  selectedIndex={safeIndex}
                  onSelect={onWarmIntroSelect}
                />
                <RelationshipGraph
                  selectedInvestor={selectedInsight}
                  selectedPath={selectedPath}
                  selectedWarmPathIndex={safeWarmPathIndex}
                  onWarmPathSelect={onWarmPathSelect}
                />
                <SelectedInvestorDetails
                  selectedInvestor={selectedInsight}
                  selectedPath={selectedPath}
                  onOpenOutreach={onOpenOutreach}
                />
              </div>
            ) : (
              <EmptyRelationshipState title="No relationship intelligence results found." />
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
                    : "Upload your pitch deck to unlock relationship intelligence insights."}
                </p>
                {!relationshipLoading && !pitchDeckUploaded && (
                  <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
                    <Upload size={16} />
                    Upload Pitch Deck
                    <input type="file" accept="application/pdf,.pdf" onChange={onPitchDeckChange} className="hidden" />
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

function RelationshipInvestorList({ investors, selectedIndex, onSelect }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-950">Top Investor Matches</p>
        <p className="mt-1 text-xs text-slate-500">Backend relationship intelligence results only.</p>
      </div>
      <div className="space-y-3">
        {investors.map((investor, index) => (
          <button
            key={`${investor.investorName}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              selectedIndex === index
                ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{investor.investorName}</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                {investor.warmPaths.length} paths
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600">
              {hasValue(investor.matchScore) && <p>Match score: {formatRelationshipScore(investor.matchScore)}</p>}
              {hasValue(investor.relationshipScore) && <p>Relationship score: {formatRelationshipScore(investor.relationshipScore)}</p>}
              {investor.confidence && <p>Confidence: {investor.confidence}</p>}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function getGraphNodeStyles(type) {
  const styles = {
    founder: "border-blue-600 bg-blue-600 text-white",
    person: "border-blue-600 bg-white text-blue-700",
    organization: "border-blue-200 bg-blue-50 text-blue-800",
    investor: "border-[#07182f] bg-[#07182f] text-white",
    portfolio: "border-blue-200 bg-white text-blue-700",
    unknown: "border-slate-300 bg-slate-100 text-slate-600",
  };

  return styles[type] || styles.unknown;
}

function RelationshipGraph({ selectedInvestor, selectedPath, selectedWarmPathIndex, onWarmPathSelect }) {
  const nodes = selectedPath?.nodes || [];
  const edges = selectedPath?.edges || [];

  if (!selectedInvestor) return <EmptyRelationshipState compact title="No relationship intelligence results found." />;
  if (!nodes.length) return <EmptyRelationshipState compact title="No warm introduction path found for this investor." investorName={selectedInvestor.investorName} />;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Relationship Graph</p>
          <p className="mt-1 text-xs text-slate-500">Selected warm introduction path from backend data.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          <Network size={13} />
          Warm Path
        </span>
      </div>

      {selectedInvestor.warmPaths.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedInvestor.warmPaths.map((path, index) => (
            <button
              key={path.id}
              type="button"
              onClick={() => onWarmPathSelect(index)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                selectedWarmPathIndex === index
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-blue-50 text-blue-700 ring-blue-100 hover:bg-blue-100"
              }`}
            >
              Path {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[390px] overflow-x-auto rounded-lg border border-blue-100 bg-blue-50/40 p-5">
        <div className="flex min-w-max items-center py-20 text-left">
          {nodes.map((node, index) => {
            const nextNode = nodes[index + 1];
            const edge = nextNode ? getConsecutiveEdge(edges, node, nextNode) : null;
            const edgeLabel = getEdgeLabel(edge);

            return (
              <React.Fragment key={node.id}>
                <div className="flex w-36 shrink-0 flex-col items-center text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-sm ring-4 ring-white ${getGraphNodeStyles(node.type)}`}>
                    {getRelationshipNodeIcon(node.type)}
                  </div>
                  <p className="mt-3 w-full text-sm font-semibold leading-5 text-slate-950">{node.label}</p>
                  {node.subtitle && <p className="mt-1 w-full text-xs leading-4 text-slate-500">{node.subtitle}</p>}
                  {node.type && <p className="mt-2 text-[11px] font-semibold uppercase text-blue-700">{node.type}</p>}
                </div>

                {nextNode && edge && (
                  <div className="relative flex w-28 shrink-0 items-center justify-center">
                    <div className="h-0.5 w-full bg-blue-500" />
                    <ArrowRight className="absolute right-0 text-blue-600" size={16} />
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

function SelectedInvestorDetails({ selectedInvestor, selectedPath, onOpenOutreach }) {
  if (!selectedInvestor) return <EmptyRelationshipState compact title="No relationship intelligence results found." />;
  const pathSummary = getWarmIntroPathSummary(selectedPath);

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{selectedInvestor.investorName}</p>
          <p className="mt-1 text-xs text-slate-500">Selected investor details</p>
        </div>
        {hasValue(selectedInvestor.matchScore) && (
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            {formatRelationshipScore(selectedInvestor.matchScore)}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-3 text-sm">
        {hasValue(selectedInvestor.relationshipScore) && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Relationship Score</p>
            <p className="mt-1 font-semibold text-slate-950">{formatRelationshipScore(selectedInvestor.relationshipScore)}</p>
          </div>
        )}

        {selectedInvestor.confidence && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Confidence</p>
            <p className="mt-1 font-semibold text-slate-950">{selectedInvestor.confidence}</p>
          </div>
        )}

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase text-blue-700">Best Warm Introduction Path</p>
          {selectedPath ? (
            <>
              <p className="mt-2 font-semibold leading-6 text-slate-950">{pathSummary}</p>
              {selectedPath.introducerName && <p className="mt-2 text-slate-700">Introducer: {selectedPath.introducerName}</p>}
              {selectedPath.targetContact && <p className="mt-1 text-slate-700">Target contact: {selectedPath.targetContact}</p>}
              {selectedPath.confidence && <p className="mt-1 text-slate-700">Confidence: {selectedPath.confidence}</p>}
            </>
          ) : (
            <p className="mt-2 font-semibold text-slate-700">No warm introduction path found for this investor.</p>
          )}
        </div>

        {selectedPath?.evidence?.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Evidence & Signals</p>
            <ul className="mt-2 space-y-2">
              {selectedPath.evidence.map((evidence) => (
                <li key={evidence} className="flex gap-2 leading-5 text-slate-600">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={15} />
                  <span>{evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-slate-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Suggested Next Step</p>
          <button
            type="button"
            onClick={onOpenOutreach}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Send size={16} />
            {selectedPath ? "Generate outreach using this warm path" : "Generate direct investor outreach"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function RelationshipSummaryPanel({ insights, selectedIndex, selectedInsight, selectedWarmIntro, onSelect, onOpenOutreach }) {
  if (!selectedInsight) return <EmptyRelationshipState compact title="No warm introduction path found." />;
  const pathSummary = getWarmIntroPathSummary(selectedWarmIntro);

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
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase text-blue-700">Warm Introduction Path</p>
          {selectedWarmIntro?.pathNodes?.length > 0 ? (
            <>
              <p className="mt-2 font-semibold leading-6 text-slate-950">{pathSummary}</p>
              {selectedWarmIntro.introducerName && (
                <p className="mt-2 text-sm text-slate-700">Suggested introducer: {selectedWarmIntro.introducerName}</p>
              )}
              {hasValue(selectedWarmIntro.pathScore) && (
                <p className="mt-2 text-sm text-slate-700">Path score: {formatRelationshipScore(selectedWarmIntro.pathScore)}</p>
              )}
              {selectedWarmIntro.confidence && (
                <p className="mt-1 text-sm text-slate-700">Confidence: {selectedWarmIntro.confidence}</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-600">No warm introduction path found.</p>
          )}
        </div>

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

      <button type="button" onClick={onOpenOutreach} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#07182f] px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
        <Send size={16} />
        Suggested outreach
      </button>
    </aside>
  );
}

function EmptyRelationshipState({ compact = false, title = "No relationship path found yet.", investorName = "" }) {
  return (
    <div className={`rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center ${compact ? "" : "min-h-[280px] flex flex-col items-center justify-center"}`}>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Network size={18} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
      {investorName && <p className="mt-1 text-sm font-semibold text-blue-700">Investor match: {investorName}</p>}
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Try uploading LinkedIn connection data or adding founder network information.
      </p>
    </div>
  );
}

function OutreachPanel({
  formData,
  selectedWarmIntro,
  selectedInvestor,
  generatedEmail,
  setGeneratedEmail,
  emailTone,
  setEmailTone,
  emailNotice,
  onGenerateWarmIntroEmail,
  onCopyEmail,
  onSendEmail,
  onSendLinkedIn,
}) {
  const hasIntroducer = Boolean(selectedWarmIntro?.introducerName);
  const pathSummary = getWarmIntroPathSummary(selectedWarmIntro);
  const hasWarmPath = Boolean(selectedWarmIntro?.nodes?.length || selectedWarmIntro?.pathNodes?.length);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-blue-700">Warm Intro Helper</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedWarmIntro?.investorName || selectedInvestor || "Investor outreach"}</h3>
            {hasWarmPath ? (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase text-blue-700">Warm Introduction Path</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{pathSummary}</p>
                {selectedWarmIntro.introducerName && (
                  <p className="mt-2 text-sm text-slate-700">Suggested introducer: {selectedWarmIntro.introducerName}</p>
                )}
                {selectedWarmIntro.targetContact && (
                  <p className="mt-1 text-sm text-slate-700">Target contact: {selectedWarmIntro.targetContact}</p>
                )}
                {selectedWarmIntro.confidence && <p className="mt-1 text-sm text-slate-700">Confidence: {selectedWarmIntro.confidence}</p>}
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={onGenerateWarmIntroEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
                <Sparkles size={16} />
                Generate Warm Intro Message
              </button>
              <button type="button" onClick={onCopyEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
                <Copy size={16} />
                Copy Message
              </button>
              <button type="button" onClick={onSendEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                <Mail size={16} />
                Send via Email
              </button>
              <button type="button" onClick={onSendLinkedIn} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#07182f] px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
                <ExternalLink size={16} />
                Send via LinkedIn
              </button>
            </div>
            {!formData.pitchDeck && (
              <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                Upload a pitch deck to strengthen this outreach.
              </p>
            )}
          </section>

          {selectedWarmIntro?.evidence?.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Evidence & Signals</p>
              <ul className="mt-3 space-y-2">
                {selectedWarmIntro.evidence.map((evidence) => (
                  <li key={evidence} className="flex gap-2 text-sm leading-5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-blue-600" size={15} />
                    <span>{evidence}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-700">Outreach Email</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                {hasIntroducer ? "Warm intro request" : "Direct investor outreach"}
              </h3>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {["Professional", "Friendly", "Concise"].map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setEmailTone(tone)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    emailTone === tone ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InputLike label="To" value={generatedEmail.to || selectedWarmIntro?.targetContact || selectedWarmIntro?.investorName || selectedInvestor || ""} onChange={(value) => setGeneratedEmail((prev) => ({ ...prev, to: value }))} />
            <InputLike label="Intro Request To" value={generatedEmail.introRequestTo || selectedWarmIntro?.introducerName || ""} onChange={(value) => setGeneratedEmail((prev) => ({ ...prev, introRequestTo: value }))} />
          </div>
          <div className="mt-4">
            <InputLike label="Subject" value={generatedEmail.subject} onChange={(value) => setGeneratedEmail((prev) => ({ ...prev, subject: value }))} />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email body</label>
            <textarea
              value={generatedEmail.body}
              onChange={(e) => setGeneratedEmail((prev) => ({ ...prev, body: e.target.value }))}
              rows={13}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={onGenerateWarmIntroEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Sparkles size={16} />
              Generate Warm Intro Message
            </button>
            <button type="button" onClick={onCopyEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
              <Copy size={16} />
              Copy Message
            </button>
            <button type="button" onClick={onSendEmail} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#07182f] px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Mail size={16} />
              Send via Email
            </button>
            <button type="button" onClick={onSendLinkedIn} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
              <ExternalLink size={16} />
              Send via LinkedIn
            </button>
          </div>
          {emailNotice && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{emailNotice}</p>}
        </section>
      </div>
    </div>
  );
}

function InputLike({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
      />
    </label>
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
