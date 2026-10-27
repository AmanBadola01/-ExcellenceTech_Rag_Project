import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api, errorMessage } from "@/lib/api";
import type { CompanyData } from "@/lib/api";

export const Route = createFileRoute("/studio/company")({
  ssr: false,
  component: CompanyPage,
});

const EMPTY: CompanyData = {
  name: "",
  website: "",
  industry: "",
  tagline: "",
  description: "",
  products_services: "",
  target_market: "",
  value_props: "",
  boilerplate: "",
  contact_info: "",
  default_language: "",
};

function Field({
  label,
  name,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  name: keyof CompanyData;
  value: string;
  onChange: (name: keyof CompanyData, val: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const base =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {multiline ? (
        <textarea
          name={name}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(name, e.target.value)}
          className={base + " resize-y"}
        />
      ) : (
        <input
          type="text"
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(name, e.target.value)}
          className={base}
        />
      )}
    </div>
  );
}

function CompanyPage() {
  const [form, setForm] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getCompany();
        if (!cancelled) setForm(data);
      } catch (err: any) {
        // 404 = no record yet — keep empty form
        if (err?.status !== 404 && !cancelled) {
          setErrMsg(errorMessage(err));
          setStatus("error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (name: keyof CompanyData, val: string) => {
    setForm((prev) => ({ ...prev, [name]: val }));
    setStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const saved = await api.saveCompany(form);
      setForm(saved);
      setStatus("success");
    } catch (err) {
      setErrMsg(errorMessage(err));
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading company profile…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This information is used to personalise AI-generated content for your brand.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Company name" name="name" value={form.name} onChange={handleChange} placeholder="Acme Corp" />
        <Field label="Website" name="website" value={form.website} onChange={handleChange} placeholder="https://example.com" />
        <Field label="Industry" name="industry" value={form.industry} onChange={handleChange} placeholder="SaaS / Fintech / Healthcare…" />
        <Field label="Tagline" name="tagline" value={form.tagline} onChange={handleChange} placeholder="Your one-liner" />
        <Field label="Description" name="description" value={form.description} onChange={handleChange} multiline placeholder="Brief overview of what your company does" />
        <Field label="Products / Services" name="products_services" value={form.products_services} onChange={handleChange} multiline placeholder="List your key offerings" />
        <Field label="Target market" name="target_market" value={form.target_market} onChange={handleChange} multiline placeholder="Who are your ideal customers?" />
        <Field label="Value propositions" name="value_props" value={form.value_props} onChange={handleChange} multiline placeholder="What makes you different?" />
        <Field label="Boilerplate" name="boilerplate" value={form.boilerplate} onChange={handleChange} multiline placeholder="Standard 'About us' paragraph used at end of press releases" />
        <Field label="Contact info" name="contact_info" value={form.contact_info} onChange={handleChange} placeholder="press@example.com / +1-555-0100" />
        <Field label="Default language" name="default_language" value={form.default_language} onChange={handleChange} placeholder="English" />

        {status === "success" && (
          <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400">
            ✓ Company profile saved successfully.
          </p>
        )}
        {status === "error" && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {errMsg || "Failed to save. Please try again."}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] px-5 py-2 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

