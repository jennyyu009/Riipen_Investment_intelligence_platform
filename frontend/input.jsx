import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  LogOut,
  Link,
  Mail,
  MessageCircle,
  Network,
  Send,
  ShieldCheck,
  Sparkles,
  TableProperties,
  TrendingUp,
  Upload,
  User,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const demoMatches = [
  "Northstar Ventures",
  "Blue Ridge Capital",
  "Maple Seed Fund",
  "Harbor Growth Partners",
  "Signal Peak VC",
  "Frontier Fintech Fund",
  "Catalyst Angels",
  "Summit Bridge Capital",
  "Latitude Ventures",
  "Meridian Capital",
  "Foundry Collective",
  "Arcadia Partners",
  "Cedar Street Ventures",
  "Brightline Capital",
  "Pacific Anchor Fund",
].map((entityName, index) => ({
  investor_id: index + 1,
  entity_name: entityName,
  final_score: Math.max(72, 98 - index * 2),
}));

export default function FounderIntakeForm() {
  const [page, setPage] = useState("landing");
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
  const [deckBoost, setDeckBoost] = useState(0);
  const [deckError, setDeckError] = useState("");
  const [activePanel, setActivePanel] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Upload client information or paste notes here. I will keep the context attached to this dashboard section.",
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
              investor_id: investor.investor_id || index + 1,
              entity_name: investor.entity_name || `Investor ${index + 1}`,
              final_score: investor.final_score || investor.final_score_scaled || 0,
            }))
          : demoMatches;

        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(normalizedMatches);
          setMatchingSource(topInvestors.length ? "backend" : "demo");
          setMatchingLoading(false);
        }, remainingDelay);
      } catch (error) {
        const remainingDelay = Math.max(0, 1400 - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (cancelled) return;
          setMatches(demoMatches);
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
        text: `This chat is attached to ${panel.title}. Upload client information or add notes for this section.`,
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
      { role: "user", text: `Uploaded client file: ${file.name}` },
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
      subtitle: "Add customer context and warm intro notes.",
      icon: <Network size={20} />,
    },
    {
      id: "discovery",
      title: "Investor Exploration",
      subtitle: "Capture discovery feedback and investor notes.",
      icon: <MessageCircle size={20} />,
    },
  ];

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

            <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white p-6 shadow-xl md:p-8">
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
        <div className="min-h-screen bg-[#eef3f7] px-4 py-8 text-slate-900">
          <style>{`
            @keyframes scoreGlow {
              0%, 100% { transform: scale(1); box-shadow: 0 20px 60px rgba(77, 120, 155, .18); }
              50% { transform: scale(1.04); box-shadow: 0 24px 80px rgba(77, 120, 155, .34); }
            }

            @keyframes loadingSweep {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }

            .deck-score-glow { animation: scoreGlow 1.8s ease-in-out infinite; }
            .loading-sweep { animation: loadingSweep 1.4s ease-in-out infinite; }
          `}</style>

          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white bg-white/90 p-5 shadow-xl shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[#4d789b]">Dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                  Good Evening{formData.name ? `, ${formData.name}` : ""}
                </h1>
              </div>
              <div className="flex items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4d789b] text-white">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formData.name || "User"}</p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <button type="button" onClick={() => openPanel({ id: "profile", title: "Profile", subtitle: "Submitted form table." })} className="hover:text-[#4d789b]">
                      Profile
                    </button>
                    <span>•</span>
                    <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1 hover:text-[#4d789b]">
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
              <button
                type="button"
                onClick={() => openPanel(dashboardPanels[0])}
                className="rounded-[28px] border border-white bg-white p-6 text-left shadow-xl shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-[#4d789b]">Matching</p>
                    <h2 className="mt-2 text-2xl font-semibold">Top 15 matching results</h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f1f7] px-4 py-2 text-sm font-semibold text-[#345f82]">
                    {matchingLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {matchingLoading ? "Loading matches" : matchingSource === "backend" ? "Live results" : "Demo results"}
                  </span>
                </div>

                {matchingLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div key={item} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="loading-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                        <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                        <div className="mt-3 h-3 w-1/4 rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {matches.map((match, index) => (
                      <div key={`${match.entity_name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                          <span className="rounded-full bg-[#4d789b] px-3 py-1 text-sm font-bold text-white">
                            {Math.round(match.final_score)}%
                          </span>
                        </div>
                        <p className="mt-3 truncate text-sm font-semibold text-slate-800">{match.entity_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </button>

              <div
                role="button"
                tabIndex={0}
                onClick={() => openPanel(dashboardPanels[1])}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openPanel(dashboardPanels[1]);
                }}
                className="rounded-[28px] border border-white bg-gradient-to-br from-[#4d789b] to-[#315b7d] p-6 text-left text-white shadow-xl shadow-[#4d789b]/20 transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-blue-50/80">Pitch deck status</p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="deck-score-glow rounded-[24px] bg-white px-6 py-4 text-6xl font-black text-[#315b7d]">
                    {deckBoost}%
                  </span>
                  <span className="pb-3 text-sm font-medium text-blue-50/90">
                    matching lift
                  </span>
                </div>
                <h2 className="mt-6 text-2xl font-semibold">
                  {formData.pitchDeck ? "Pitch deck uploaded" : "Upload your pitch deck"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-blue-50/80">
                  {formData.pitchDeck ? formData.pitchDeck.name : "PDF only. The deck signal is highlighted because it improves investor ranking quality."}
                </p>
                <label onClick={(e) => e.stopPropagation()} className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-4 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/25">
                  <Upload size={18} />
                  Upload PDF
                  <input type="file" accept="application/pdf,.pdf" onChange={handlePitchDeckChange} className="hidden" />
                </label>
                {deckError && <p className="mt-3 text-sm font-semibold text-rose-100">{deckError}</p>}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {[...dashboardPanels.slice(2), {
                id: "profile",
                title: "Profile Table",
                subtitle: "Review the submitted founder and startup fields.",
                icon: <TableProperties size={20} />,
              }].map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => openPanel(panel)}
                  className="rounded-[24px] border border-white bg-white p-5 text-left shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-[#b8cfe1]"
                >
                  <div className="mb-5 inline-flex rounded-2xl bg-[#e8f1f7] p-3 text-[#4d789b]">
                    {panel.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-950">{panel.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{panel.subtitle}</p>
                  <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#4d789b]">
                    Open workspace <ArrowRight size={16} />
                  </p>
                </button>
              ))}
            </div>

            {activePanel && (
              <div className="fixed inset-0 z-50 bg-slate-950/35 p-4 backdrop-blur-sm">
                <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 p-5">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[#4d789b]">{activePanel.id}</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-950">{activePanel.title}</h2>
                    </div>
                    <button type="button" onClick={() => setActivePanel(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                      <X size={20} />
                    </button>
                  </div>

                  {activePanel.id === "profile" ? (
                    <div className="overflow-auto p-5">
                      <div className="mb-4 flex items-center gap-2 text-[#4d789b]">
                        <TableProperties size={20} />
                        <span className="font-semibold">Submitted form table</span>
                      </div>
                      <table className="w-full overflow-hidden rounded-2xl text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {[
                            ["Name", formData.name],
                            ["Current Role", formData.currentRole || "-"],
                            ["Email", formData.email || "-"],
                            ["LinkedIn URL", formData.linkedinUrl],
                            ["Startup Name", formData.startupName],
                            ["Website URL", formData.websiteUrl || "-"],
                            ["Stage", formData.stage],
                            ["Industry", formData.industry.join(", ")],
                            ["Business Model", formData.businessModel.join(", ")],
                            ["Fundraising Preferences", formData.fundraisingPreference],
                            ["Pitch Deck", formData.pitchDeck?.name || "Not uploaded"],
                          ].map(([label, value]) => (
                            <tr key={label}>
                              <th className="w-44 bg-slate-50 px-4 py-3 font-semibold text-slate-600">{label}</th>
                              <td className="px-4 py-3 text-slate-900">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 space-y-4 overflow-auto bg-slate-50 p-5">
                        {chatMessages.map((message, index) => (
                          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#4d789b] text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                              {message.text}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-100 p-4">
                        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-[#4d789b] hover:text-[#4d789b]">
                          <Upload size={17} />
                          Upload client information
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
                            className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[#4d789b] focus:ring-2 focus:ring-[#dbeaf4]"
                          />
                          <button type="button" onClick={handleChatSend} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4d789b] text-white hover:bg-[#345f82]">
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
