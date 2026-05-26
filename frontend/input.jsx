import React, { useState } from "react";
import { Upload, Link, Building2, User, Mail, Sparkles } from "lucide-react";

export default function FounderIntakeForm() {
  const [formData, setFormData] = useState({
    name: "",
    linkedinUrl: "",
    linkedinConnectionData: null,
    currentRole: "",
    email: "",
    startupName: "",
    websiteUrl: "",
    stage: "",
    industry: "",
    fundraisingPreference: "",
    pitchDeck: null,
  });

  const [submitted, setSubmitted] = useState(false);

  const stages = ["Idea", "Pre-seed", "Seed", "Series A"];
  const industries = [
    "AI",
    "Fintech",
    "HealthTech",
    "ClimateTech",
    "Enterprise SaaS",
    "Developer Tools",
    "Consumer",
    "Marketplace",
    "Cybersecurity",
    "LegalTech",
    "Others",
  ];

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    console.log("Founder Intake Form Data:", formData);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            <Sparkles size={16} />
            Investor Matching Intake
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Find the right investors through relationship intelligence
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            Share your founder profile, startup details, relationship data, and fundraising goals. The platform will use this information to support investor matching, warm introductions, and outreach recommendations.
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

            <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Upload className="mx-auto mb-3" size={30} />
              <h2 className="text-lg font-semibold">
                LinkedIn Connection Data <span className="text-red-500">*</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload exported LinkedIn connections as CSV, XLSX, or TXT
              </p>
              <input
                type="file"
                name="linkedinConnectionData"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleChange}
                required
                className="mt-4 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              {formData.linkedinConnectionData && (
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Selected: {formData.linkedinConnectionData.name}
                </p>
              )}
            </section>
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
              <Select label="Industry" name="industry" value={formData.industry} onChange={handleChange} options={industries} required />
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

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-slate-700"
          >
            Submit Founder Profile
          </button>

          {submitted && (
            <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">
              Profile submitted successfully. Check the browser console to view the form data.
            </div>
          )}
        </form>
      </div>
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

function Divider() {
  return <div className="h-px w-full bg-slate-100" />;
}
