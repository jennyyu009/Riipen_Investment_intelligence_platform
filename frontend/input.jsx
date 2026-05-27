import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Link,
  Mail,
  Network,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";

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

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const isFormValid =
    formData.name.trim() &&
    formData.linkedinUrl.trim() &&
    formData.startupName.trim() &&
    formData.stage &&
    formData.industry.length > 0 &&
    formData.businessModel.length > 0 &&
    formData.fundraisingPreference.trim();

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
                <p className="mt-1 text-sm text-slate-500">PDF, PPT, or PPTX recommended</p>
                <input
                  type="file"
                  name="pitchDeck"
                  accept=".pdf,.ppt,.pptx"
                  onChange={handleChange}
                  className="mt-4 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
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
        <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                  Good Evening{formData.name ? `, ${formData.name}` : ""}
                </h1>
              </div>
              <div className="flex items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-700">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formData.name || "User"}</p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <button className="hover:text-slate-900">Profile</button>
                    <span>•</span>
                    <button className="hover:text-slate-900">Log out</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-10 text-center shadow-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Pitch deck status</p>
                <h2 className="mt-4 text-3xl font-semibold text-slate-900">No pitch deck uploaded yet</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Upload your deck to improve matching by <span className="font-semibold text-slate-900">28%</span>.
                </p>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Matching</p>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">Pitch deck insights</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Coming after you submit your deck. Matching score and investor fit appear here.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Relationship</p>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">Connection intelligence</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Connection data and warm introduction readiness will be updated from the backend.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Discover investors</p>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">Investor exploration</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Recommendations for relevant investors based on your profile and fundraising goals.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
