import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";
import api from "../../services/api";
import { PublicHeader, PublicFooter } from "../../components/layout/PublicChrome";

type ServiceOption = {
  value: string;
  label: string;
  description: string;
};

type EnquiryForm = {
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  monthlyShipmentVolume: string;
  services: string[];
  message: string;
};

const serviceOptions: ServiceOption[] = [
  { value: "local_delivery", label: "Local deliveries", description: "Same-city business shipments" },
  { value: "intercity_transport", label: "Intercity transport", description: "Move goods between cities" },
  { value: "bulk_logistics", label: "Bulk logistics", description: "Larger or heavier consignments" },
  { value: "scheduled_deliveries", label: "Scheduled deliveries", description: "Recurring or planned trips" },
  { value: "multi_location", label: "Multi-location operations", description: "Deliveries across multiple sites" },
];

const initialForm: EnquiryForm = {
  contactName: "",
  email: "",
  phone: "",
  companyName: "",
  city: "",
  monthlyShipmentVolume: "",
  services: [],
  message: "",
};

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

function Business() {
  const [form, setForm] = useState<EnquiryForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ enquiryCode: string; message: string } | null>(null);

  function toggleService(value: string) {
    setForm((current) => ({
      ...current,
      services: current.services.includes(value)
        ? current.services.filter((service) => service !== value)
        : [...current.services, value],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.services.length === 0) {
      setError("Choose at least one service so our team can understand your requirements.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/enterprise/enquiries", {
        ...form,
        contactName: form.contactName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        companyName: form.companyName.trim(),
        city: form.city.trim(),
        message: form.message.trim(),
      });
      if (!response.data?.success || !response.data?.enquiry?.enquiryCode) {
        throw new Error(response.data?.message || "The enquiry could not be saved. Please try again.");
      }
      setSuccess({
        enquiryCode: response.data?.enquiry?.enquiryCode || "Reference pending",
        message: response.data?.message || "Your business enquiry has been received.",
      });
      setForm(initialForm);
    } catch (requestError: unknown) {
      const candidate = requestError as { response?: { data?: { message?: string } }; message?: string };
      setError(
        candidate.response?.data?.message ||
          (candidate.message === "Network Error"
            ? "We could not reach LogiGo right now. Check the API is running and try again."
            : "We could not submit your enquiry. Please review the details and try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lgx min-h-screen bg-[#f7f3e9] text-slate-900">
      <PublicHeader />

      <main>
        <section className="lgx-hero relative overflow-hidden bg-[#10213a] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 left-[22%] h-80 w-80 rounded-full bg-orange-500/15 blur-3xl" />

          <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.96fr)] lg:items-start lg:gap-10 lg:px-8 lg:py-12">
            <div className="min-w-0 lg:sticky lg:top-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200"><Building2 size={14} /> LogiGo for business</span>
              <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Make business deliveries <span className="text-orange-300">simpler.</span></h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">Tell us how your business moves goods. Share your delivery needs and request a conversation about a logistics setup that fits your operations.</p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-100 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2"><Route size={16} className="text-orange-300" /> Local and intercity trips</span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2"><PackageCheck size={16} className="text-emerald-300" /> Business cargo needs</span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-white/15 bg-[#203b2d]/90 p-4 shadow-lg shadow-slate-950/10 backdrop-blur-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400/15 text-orange-300"><Truck size={21} /></span>
                  <h2 className="mt-3 text-base font-extrabold">Move what matters</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-200">Describe your load, routes and vehicle requirements in one request.</p>
                </article>
                <article className="rounded-2xl border border-white/15 bg-[#203b2d]/90 p-4 shadow-lg shadow-slate-950/10 backdrop-blur-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><ShieldCheck size={21} /></span>
                  <h2 className="mt-3 text-base font-extrabold">Clear requirements</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-200">Tell us the expected shipment volume and services you need.</p>
                </article>
                <article className="rounded-2xl border border-white/15 bg-[#203b2d]/90 p-4 shadow-lg shadow-slate-950/10 backdrop-blur-sm sm:col-span-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><FileCheck2 size={21} /></span>
                  <h2 className="mt-3 text-base font-extrabold">One request to start</h2>
                  <p className="mt-1.5 max-w-lg text-xs leading-5 text-slate-200">Submit your business enquiry. The request is saved for the LogiGo team to review; it does not create a company account, book a vehicle, or set up billing.</p>
                </article>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-300" /> No account required</span>
                <span className="text-white/40">•</span>
                <span className="inline-flex items-center gap-2"><Clock3 size={15} className="text-orange-300" /> Enquiry reference for follow-up</span>
              </div>
            </div>

            <section id="business-enquiry-form" aria-labelledby="business-form-title" className="min-w-0 scroll-mt-6 rounded-3xl border border-white/70 bg-[#fffdf8] p-5 text-slate-900 shadow-2xl shadow-slate-950/25 sm:p-7 lg:p-8">
              {success ? (
                <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={32} /></span>
                  <h2 id="business-form-title" className="mt-5 text-2xl font-black">Enquiry received</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{success.message}</p>
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3"><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Enquiry reference</span><strong className="mt-1 block break-all text-lg font-black text-slate-900">{success.enquiryCode}</strong></div>
                  <button type="button" onClick={() => setSuccess(null)} className="mt-6 rounded-xl bg-[#203b2d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#172d21]">Submit another enquiry</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-700">Business enquiry</p>
                    <h2 id="business-form-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Tell us about your business</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">Complete this form and our team can review your logistics requirements.</p>
                  </div>

                  {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-bold text-slate-700">Full name *<input className={inputClass} value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} autoComplete="name" required minLength={2} maxLength={80} placeholder="Your name" /></label>
                    <label className="block text-sm font-bold text-slate-700">Work email *<input className={inputClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required maxLength={254} placeholder="you@company.com" /></label>
                    <label className="block text-sm font-bold text-slate-700">Phone number *<input className={inputClass} type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" required minLength={10} maxLength={25} placeholder="+91 98765 43210" /></label>
                    <label className="block text-sm font-bold text-slate-700">Company name *<input className={inputClass} value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} autoComplete="organization" required minLength={2} maxLength={120} placeholder="Your business" /></label>
                    <label className="block text-sm font-bold text-slate-700">Primary operating city *<input className={inputClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required minLength={2} maxLength={80} placeholder="e.g. Pune" /></label>
                    <label className="block text-sm font-bold text-slate-700">Shipments per month *<select className={inputClass} value={form.monthlyShipmentVolume} onChange={(event) => setForm({ ...form, monthlyShipmentVolume: event.target.value })} required><option value="">Select a range</option><option value="1-50">1–50</option><option value="51-200">51–200</option><option value="201-1000">201–1,000</option><option value="1000+">1,000+</option></select></label>
                  </div>

                  <fieldset>
                    <legend className="text-sm font-bold text-slate-700">Which services do you need? *</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {serviceOptions.map((option) => (
                        <label key={option.value} className={`flex min-w-0 cursor-pointer gap-3 rounded-xl border p-3 transition ${form.services.includes(option.value) ? "border-orange-300 bg-orange-50/70" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <input type="checkbox" checked={form.services.includes(option.value)} onChange={() => toggleService(option.value)} className="mt-1 h-4 w-4 shrink-0 accent-orange-500" />
                          <span className="min-w-0"><strong className="block text-sm text-slate-800">{option.label}</strong><small className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block text-sm font-bold text-slate-700">Tell us about your requirements *<textarea className={`${inputClass} min-h-28 resize-y`} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required minLength={10} maxLength={2000} placeholder="Typical routes, load type, schedule, or any other details that help us understand your needs." /></label>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-sm text-xs leading-5 text-slate-500">Your enquiry is stored for the LogiGo team to review. Do not include payment credentials or sensitive personal documents.</p>
                    <button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{submitting ? "Submitting…" : "Submit business enquiry"}<ArrowRight size={17} /></button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default Business;
