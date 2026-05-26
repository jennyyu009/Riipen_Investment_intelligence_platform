import React, { useState, useEffect, useRef } from "react";
import { Upload, Link, Building2, User, Mail, Sparkles } from "lucide-react";

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

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const isFormValid =
    formData.name.trim() &&
    formData.email.trim() &&
    formData.linkedinUrl.trim() &&
    formData.startupName.trim() &&
    formData.stage &&
    formData.industry.length > 0 &&
    formData.businessModel.length > 0 &&
    formData.fundraisingPreference.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) {
      setSubmitError(true);
      return;
    }
    setSubmitError(false);
    setSubmitted(true);
    setPage("dashboard");
    console.log("Founder Intake Form Data:", formData);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {page === "landing" ? (
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-3xl rounded-[32px] border border-slate-200 bg-white/90 p-10 shadow-xl backdrop-blur-sm">
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Investor Matching</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                Discover better fundraising through relationship intelligence.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Start your journey with a simple founder intake, then explore matching, relationship insights, and investor discovery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPage("form")}
              className="mt-6 inline-flex rounded-3xl bg-slate-900 px-8 py-4 text-base font-semibold text-white transition hover:bg-slate-700"
            >
              Start
            </button>
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
                  Please complete all required fields before submitting.
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
