import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search } from "lucide-react";
import api from "../../services/api";

type EnquiryStatus = "new" | "contacted" | "qualified" | "closed";
type EnquiryService = "local_delivery" | "intercity_transport" | "bulk_logistics" | "scheduled_deliveries" | "multi_location";

interface EnterpriseEnquiry {
  _id: string;
  enquiryCode: string;
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  monthlyShipmentVolume: string;
  services: EnquiryService[];
  message: string;
  status: EnquiryStatus;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

interface EnquirySummary {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  closed: number;
}

const statusLabels: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  closed: "Closed",
};

const serviceLabels: Record<EnquiryService, string> = {
  local_delivery: "Local deliveries",
  intercity_transport: "Intercity transport",
  bulk_logistics: "Bulk logistics",
  scheduled_deliveries: "Scheduled deliveries",
  multi_location: "Multi-location operations",
};

const statusClass: Record<EnquiryStatus, string> = {
  new: "border-amber-200 bg-amber-50 text-amber-800",
  contacted: "border-sky-200 bg-sky-50 text-sky-700",
  qualified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-100 text-slate-600",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function AdminEnterpriseEnquiries() {
  const [enquiries, setEnquiries] = useState<EnterpriseEnquiry[]>([]);
  const [summary, setSummary] = useState<EnquirySummary>({ total: 0, new: 0, contacted: 0, qualified: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, EnquiryStatus>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadEnquiries = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await api.get("/enterprise/admin/enquiries", {
        params: { status: statusFilter, search: appliedQuery, page, limit: 20 },
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Could not load business enquiries.");
      const result = response.data?.enquiries;
      if (!Array.isArray(result)) throw new Error("Unexpected response from the enterprise enquiries API.");
      setEnquiries(result as EnterpriseEnquiry[]);
      setSummary(response.data?.summary ?? { total: 0, new: 0, contacted: 0, qualified: 0, closed: 0 });
      setPages(Math.max(1, Number(response.data?.pagination?.pages) || 1));
      setStatusDrafts((current) => {
        const next = { ...current };
        (result as EnterpriseEnquiry[]).forEach((item) => { next[item._id] = current[item._id] ?? item.status; });
        return next;
      });
      setNoteDrafts((current) => {
        const next = { ...current };
        (result as EnterpriseEnquiry[]).forEach((item) => { next[item._id] = current[item._id] ?? item.adminNotes ?? ""; });
        return next;
      });
    } catch (requestError: unknown) {
      const candidate = requestError as { response?: { data?: { message?: string } }; message?: string };
      setError(candidate.response?.data?.message || candidate.message || "Could not load enterprise enquiries. Check the backend and your admin session.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, appliedQuery, page]);

  useEffect(() => { void loadEnquiries(); }, [loadEnquiries]);

  async function saveEnquiry(enquiry: EnterpriseEnquiry) {
    setSavingId(enquiry._id);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/enterprise/admin/enquiries/${enquiry._id}`, {
        status: statusDrafts[enquiry._id] ?? enquiry.status,
        adminNotes: noteDrafts[enquiry._id] ?? enquiry.adminNotes ?? "",
      });
      if (response.data?.success === false) throw new Error(response.data.message || "Could not update enquiry.");
      setNotice(`${enquiry.enquiryCode} updated successfully.`);
      await loadEnquiries(true);
    } catch (requestError: unknown) {
      const candidate = requestError as { response?: { data?: { message?: string } }; message?: string };
      setError(candidate.response?.data?.message || candidate.message || "Could not update this enquiry.");
    } finally {
      setSavingId(null);
    }
  }

  function applySearch() {
    setPage(1);
    setAppliedQuery(query.trim());
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-600">Business pipeline</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Enterprise enquiries</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review company requests, track follow-up status, and keep internal notes in one place.</p></div>
        <button type="button" onClick={() => void loadEnquiries(true)} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh</button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {([ ["All enquiries", summary.total, "text-slate-900", "bg-slate-100"], ["New", summary.new, "text-amber-800", "bg-amber-50"], ["Contacted", summary.contacted, "text-sky-700", "bg-sky-50"], ["Qualified", summary.qualified, "text-emerald-700", "bg-emerald-50"], ["Closed", summary.closed, "text-slate-600", "bg-slate-100"] ] as const).map(([label, value, color, iconBg]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} ${color}`}><Building2 size={18} /></span></div><p className={`mt-4 text-3xl font-black tracking-tight ${color}`}>{value}</p></article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form onSubmit={(event) => { event.preventDefault(); applySearch(); }} className="flex flex-col gap-3 lg:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search enterprise enquiries</span><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, contact, email or reference…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
          <select aria-label="Filter enquiry status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-orange-400"><option value="all">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="closed">Closed</option></select>
          <button type="submit" className="min-h-11 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white transition hover:bg-orange-600">Search</button>
        </form>
        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={20} /> Loading enquiries…</div>
        ) : enquiries.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Building2 size={22} /></span><h2 className="mt-4 text-lg font-extrabold">No business enquiries found</h2><p className="mt-1 max-w-md text-sm text-slate-500">New requests submitted through the public business page will appear here. Try clearing the search or status filter.</p></div>
        ) : (
          <div className="mt-5 space-y-4">
            {enquiries.map((enquiry) => (
              <article key={enquiry._id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 sm:p-5">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-extrabold text-slate-900">{enquiry.companyName}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[enquiry.status]}`}>{statusLabels[enquiry.status]}</span><span className="text-xs font-semibold text-slate-400">{enquiry.enquiryCode}</span></div><p className="mt-1 text-sm text-slate-600">{enquiry.contactName} · {enquiry.city}</p><p className="mt-1 break-all text-sm text-slate-600">{enquiry.email} · {enquiry.phone}</p><p className="mt-1 text-xs text-slate-400">Received {formatDate(enquiry.createdAt)} · {enquiry.monthlyShipmentVolume} shipments/month</p></div>
                  <label className="w-full shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500 md:w-44">Status<select value={statusDrafts[enquiry._id] ?? enquiry.status} onChange={(event) => setStatusDrafts((current) => ({ ...current, [enquiry._id]: event.target.value as EnquiryStatus }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-orange-400">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
                <div className="grid gap-4 py-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Requested services</p><div className="mt-2 flex flex-wrap gap-2">{enquiry.services.map((service) => <span key={service} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{serviceLabels[service] ?? service}</span>)}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{enquiry.message}</p></div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Internal notes<textarea value={noteDrafts[enquiry._id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [enquiry._id]: event.target.value }))} maxLength={2000} rows={3} placeholder="Add follow-up notes for the LogiGo team…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal normal-case leading-6 tracking-normal text-slate-800 outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" /><span className="mt-1 block text-right text-[11px] font-normal normal-case tracking-normal text-slate-400">{(noteDrafts[enquiry._id] ?? "").length}/2000</span></label>
                </div>
                <div className="flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={() => void saveEnquiry(enquiry)} disabled={savingId === enquiry._id} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#101c30] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{savingId === enquiry._id ? <LoaderCircle size={16} className="animate-spin" /> : null}{savingId === enquiry._id ? "Saving…" : "Save updates"}</button></div>
              </article>
            ))}
          </div>
        )}

        {!loading && pages > 1 && <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Page {page} of {pages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={16} /> Previous</button><button type="button" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">Next <ChevronRight size={16} /></button></div></div>}
      </section>
      <p className="text-xs leading-5 text-slate-500">Business enquiries are separate from customer bookings. No company account, invoice, pricing contract, or payment is created by this page.</p>
    </main>
  );
}

export default AdminEnterpriseEnquiries;
