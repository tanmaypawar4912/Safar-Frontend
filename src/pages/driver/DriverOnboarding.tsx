import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router";
import { AlertCircle, ArrowLeft, BadgeCheck, CheckCircle2, ClipboardCheck, FileImage, LoaderCircle, ShieldCheck, Upload, UserRound } from "lucide-react";
import { isAxiosError } from "axios";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import VehiclePhotoUploader, { type VehiclePhotoView } from "../../components/driver/VehiclePhotoUploader";

type PhotoView = VehiclePhotoView;
interface VehicleOption { _id: string; name: string; slug: string; capacityKg: number; isActive?: boolean; }
interface UploadedDocument { assetId: string; filename: string; }
interface Photos { front: string; right: string; left: string; back: string; }
const EMPTY_PHOTOS: Photos = { front: "", right: "", left: "", back: "" };
const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
const labelClass = "block text-sm font-bold text-slate-700";
function getError(error: unknown, fallback: string) {
  if (isAxiosError(error)) return error.response?.data?.message || (error.code === "ERR_NETWORK" ? "Cannot connect to Safar. Check that the backend is running." : fallback);
  return error instanceof Error ? error.message : fallback;
}

function DocumentUpload({ title, kind, value, onUploaded, required = true }: { title: string; kind: "license-document" | "identity-document" | "vehicle-document"; value: UploadedDocument | null; onUploaded: (doc: UploadedDocument) => void; required?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    const accepted = ["image/jpeg", "image/png", "image/webp"];
    if (!accepted.includes(file.type)) { setError("Upload a clear JPG, PNG or WEBP image of the document."); input.value = ""; return; }
    if (file.size > 8 * 1024 * 1024) { setError("File size must be 8 MB or smaller."); input.value = ""; return; }
    const data = new FormData(); data.append("file", file); data.append("kind", kind);
    setUploading(true);
    try {
      const response = await api.post("/drivers/media/upload", data);
      const assetId = response.data?.asset?.assetId || response.data?.asset?.id;
      if (!response.data?.success || !assetId) throw new Error(response.data?.message || "Document upload did not return a valid asset.");
      onUploaded({ assetId, filename: file.name });
    } catch (uploadError) { setError(getError(uploadError, "Document upload failed.")); }
    finally { setUploading(false); input.value = ""; }
  }
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><FileImage size={20}/></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-slate-800">{title}{required ? " *" : ""}</p><p className="mt-1 text-xs leading-5 text-slate-500">Clear image scan · JPG, PNG or WEBP · Maximum 8 MB</p>
      {value && <p className="mt-2 flex items-center gap-2 break-all text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/>{value.filename} uploaded</p>}
      <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#101c30] px-3.5 py-2.5 text-xs font-extrabold text-white hover:bg-[#1b2d48]">{uploading ? <LoaderCircle size={15} className="animate-spin"/> : <Upload size={15}/>}{uploading ? "Uploading…" : value ? "Replace document" : "Choose document"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={onChange}/></label>
    </div></div>{error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}</div>;
}

export default function DriverOnboarding() {
  const { user, refreshUser } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleMakeModel, setVehicleMakeModel] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState("");
  const [licenseDoc, setLicenseDoc] = useState<UploadedDocument | null>(null);
  const [identityDoc, setIdentityDoc] = useState<UploadedDocument | null>(null);
  const [vehicleDoc, setVehicleDoc] = useState<UploadedDocument | null>(null);
  const [photos, setPhotos] = useState<Photos>(EMPTY_PHOTOS);
  const [catalog, setCatalog] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => { setName(user?.name || ""); setPhone(user?.phone || ""); setProfileImage(user?.profileImage || ""); }, [user?.name, user?.phone, user?.profileImage]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [profileResult, catalogResult] = await Promise.allSettled([api.get("/drivers/profile"), api.get("/vehicles")]);
      if (profileResult.status === "fulfilled" && profileResult.value.data?.success && profileResult.value.data.profile) setAlreadySubmitted(true);
      if (catalogResult.status === "fulfilled" && catalogResult.value.data?.success) {
        const items = Array.isArray(catalogResult.value.data.vehicles) ? catalogResult.value.data.vehicles : [];
        setCatalog(items.filter((item: VehicleOption) => item.isActive !== false));
      }
    } catch { setError("Unable to load onboarding data. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const completeCount = useMemo(() => [name.trim().length >= 2, /^\+?[1-9]\d{6,14}$/.test(phone.trim()), Boolean(profileImage), licenseNumber.trim().length >= 5, Boolean(licenseExpiry && new Date(licenseExpiry) > new Date()), Boolean(vehicleType), vehicleMakeModel.trim().length >= 2, vehicleRegistration.trim().length >= 4, Number(vehicleCapacityKg) > 0, Boolean(licenseDoc), Boolean(identityDoc), Boolean(vehicleDoc), ...Object.values(photos).map(Boolean)].filter(Boolean).length, [name, phone, profileImage, licenseNumber, licenseExpiry, vehicleType, vehicleMakeModel, vehicleRegistration, vehicleCapacityKg, licenseDoc, identityDoc, vehicleDoc, photos]);
  const totalRequirements = 16;
  const ready = completeCount === totalRequirements;

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0]; if (!file) return;
    setError(""); setNotice("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Profile photo must be JPG, PNG or WEBP."); input.value = ""; return; }
    if (file.size > 8 * 1024 * 1024) { setError("Profile photo must be 8 MB or smaller."); input.value = ""; return; }
    const data = new FormData(); data.append("file", file); setProfilePhotoBusy(true);
    try { const response = await api.post("/drivers/profile/photo", data); if (!response.data?.success || !response.data?.profileImage) throw new Error(response.data?.message || "Could not save profile photo."); setProfileImage(response.data.profileImage); setNotice("Driver profile photo saved."); await refreshUser(); }
    catch (uploadError) { setError(getError(uploadError, "Unable to save profile photo.")); }
    finally { setProfilePhotoBusy(false); input.value = ""; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!ready) { setError("Complete every required field, upload all documents and add all four vehicle photos before submitting."); return; }
    if (new Date(licenseExpiry) <= new Date()) { setError("Your driving licence must not be expired."); return; }
    setSubmitting(true);
    try {
      const accountResponse = await api.patch("/auth/profile", { name: name.trim(), phone: phone.trim() });
      if (!accountResponse.data?.success) throw new Error(accountResponse.data?.message || "Unable to save personal details.");
      const payload = {
        licenseNumber: licenseNumber.trim().toUpperCase(), licenseExpiry,
        vehicleType, vehicleMakeModel: vehicleMakeModel.trim(), vehicleRegistration: vehicleRegistration.trim().toUpperCase(), vehicleCapacityKg: Number(vehicleCapacityKg),
        vehicleDocumentAssetId: vehicleDoc?.assetId,
        documents: { licenseDocumentAssetId: licenseDoc?.assetId, identityDocumentAssetId: identityDoc?.assetId, vehicleDocumentAssetId: vehicleDoc?.assetId },
        photos,
      };
      const response = await api.post("/drivers/profile", payload);
      if (!response.data?.success) throw new Error(response.data?.message || "Could not submit your driver profile.");
      await refreshUser();
      setNotice("Your onboarding request has been submitted to the Admin Dashboard. You must remain offline until approved.");
      setAlreadySubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) { setError(getError(submitError, "Unable to submit onboarding. Check your details and try again.")); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="mx-auto max-w-5xl p-6"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6"><LoaderCircle className="animate-spin text-orange-600"/>Loading driver onboarding…</div></main>;
  if (alreadySubmitted) return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6"><section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><ClipboardCheck/></span><h1 className="mt-4 text-2xl font-black text-slate-900">Onboarding submitted</h1><p className="mt-2 text-sm leading-6 text-slate-700">Your driver profile is already registered and will be reviewed by an administrator. You cannot go online or accept jobs until your profile is approved.</p><Link to="/driver/verification" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#101c30] px-4 py-3 text-sm font-extrabold text-white">View approval status <BadgeCheck size={16}/></Link></section></main>;

  return <main className="mx-auto max-w-5xl space-y-6 p-4 pb-12 sm:p-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Link to="/driver" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-orange-700"><ArrowLeft size={16}/> Driver dashboard</Link><p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-orange-700">Driver onboarding</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#101c30] sm:text-4xl">Complete your profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Add your personal information, licence, vehicle details and documents. Your account stays offline until an administrator approves it.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 sm:min-w-44"><p className="text-xs font-bold text-slate-500">Required steps complete</p><p className="mt-1 text-2xl font-black text-[#101c30]">{completeCount}/{totalRequirements}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${completeCount / totalRequirements * 100}%` }}/></div></div></header>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertCircle className="mt-0.5 shrink-0" size={18}/>{error}</div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mt-0.5 shrink-0" size={18}/>{notice}</div>}
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><UserRound/></span><div><h2 className="text-lg font-black text-slate-900">1. Personal details</h2><p className="text-xs text-slate-500">Your name, phone number and profile photo</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Full name *<input className={inputClass} value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={50} autoComplete="name" required/></label><label className={labelClass}>Phone number *<input className={inputClass} value={phone} onChange={e=>setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+919876543210" pattern="\+?[1-9][0-9]{6,14}" required/><span className="mt-1 block text-xs font-normal text-slate-500">Use international format, e.g. +919876543210.</span></label></div>
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-orange-100 bg-orange-50 text-xl font-black text-orange-700">{profileImage ? <img src={profileImage} alt="Driver profile" className="h-full w-full object-cover"/> : <UserRound/>}</div><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-slate-800">Driver profile photo *</p><p className="mt-1 text-xs text-slate-500">JPG, PNG or WEBP · Max 8 MB. Photo is saved to your account.</p><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadProfilePhoto} disabled={profilePhotoBusy}/><button type="button" onClick={()=>photoInput.current?.click()} disabled={profilePhotoBusy} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50">{profilePhotoBusy ? <LoaderCircle className="animate-spin" size={16}/> : <Upload size={16}/>}{profilePhotoBusy ? "Saving photo…" : profileImage ? "Change photo" : "Upload profile photo"}</button></div></div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><ShieldCheck/></span><div><h2 className="text-lg font-black text-slate-900">2. Driving licence and identity</h2><p className="text-xs text-slate-500">Required for verification and safety</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Driving licence number *<input className={inputClass} value={licenseNumber} onChange={e=>setLicenseNumber(e.target.value.toUpperCase())} minLength={5} maxLength={30} pattern="[A-Za-z0-9/-]+" required/></label><label className={labelClass}>Licence expiry date *<input className={inputClass} type="date" value={licenseExpiry} onChange={e=>setLicenseExpiry(e.target.value)} min={new Date(Date.now()+86400000).toISOString().slice(0,10)} required/></label></div><div className="mt-4 grid gap-4 md:grid-cols-2"><DocumentUpload title="Driving licence document" kind="license-document" value={licenseDoc} onUploaded={setLicenseDoc}/><DocumentUpload title="Identity document" kind="identity-document" value={identityDoc} onUploaded={setIdentityDoc}/></div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><FileImage/></span><div><h2 className="text-lg font-black text-slate-900">3. Vehicle details</h2><p className="text-xs text-slate-500">Use the correct registration details for the vehicle you will operate</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Vehicle category *<select className={inputClass} value={vehicleType} onChange={e=>{setVehicleType(e.target.value);const selected=catalog.find(v=>v.slug===e.target.value);if(selected?.capacityKg)setVehicleCapacityKg(String(selected.capacityKg));}} required><option value="">Select a vehicle</option>{catalog.map(v=><option key={v._id} value={v.slug}>{v.name}</option>)}</select>{catalog.length===0 && <span className="mt-1 block text-xs font-semibold text-rose-600">No active vehicles loaded. Admin must add an active vehicle category first.</span>}</label><label className={labelClass}>Make and model *<input className={inputClass} value={vehicleMakeModel} onChange={e=>setVehicleMakeModel(e.target.value)} minLength={2} maxLength={100} placeholder="e.g. Tata Ace Gold" required/></label><label className={labelClass}>Registration number *<input className={inputClass} value={vehicleRegistration} onChange={e=>setVehicleRegistration(e.target.value.toUpperCase())} minLength={4} maxLength={30} pattern="[A-Za-z0-9 -]+" placeholder="e.g. MH12AB1234" required/></label><label className={labelClass}>Load capacity (kg) *<input className={inputClass} type="number" min="1" max="50000" step="1" value={vehicleCapacityKg} onChange={e=>setVehicleCapacityKg(e.target.value)} required/></label></div><div className="mt-4"><DocumentUpload title="Vehicle registration document (RC)" kind="vehicle-document" value={vehicleDoc} onUploaded={setVehicleDoc}/></div><div className="mt-6"><h3 className="text-sm font-black text-slate-900">Vehicle photos — all four angles required *</h3><p className="mt-1 text-xs leading-5 text-slate-500">Upload clear photos of the same vehicle. Each upload is checked against your authenticated account.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{([{view:"front",title:"Front view"},{view:"back",title:"Back view"},{view:"left",title:"Left side"},{view:"right",title:"Right side"}] as {view:PhotoView;title:string}[]).map(item=><VehiclePhotoUploader key={item.view} title={item.title} view={item.view} value={photos[item.view]} required onUploaded={url=>setPhotos(prev=>({...prev,[item.view]:url}))}/>)}</div></div></section>
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-800"/><div><h2 className="font-black text-amber-950">4. Admin approval</h2><p className="mt-1 text-sm leading-6 text-amber-900">After you submit, your request appears in Admin → Driver Approvals. You will remain offline and cannot accept delivery jobs until an administrator approves your profile and required documents.</p><p className="mt-2 text-xs font-semibold text-amber-900">Uploaded documents are private assets; only authorized review flows should grant access.</p></div></div></section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Link to="/driver" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Save later / exit</Link>{ready && <button type="submit" disabled={submitting || profilePhotoBusy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="animate-spin" size={17}/> : <BadgeCheck size={17}/>}{submitting ? "Submitting for approval…" : "Submit for Admin Approval"}</button>}</div>
      {!ready && <p className="text-center text-xs font-semibold text-slate-500">Complete all {totalRequirements} requirements to enable submission. The Submit for Admin Approval button appears after all required information and uploads are complete.</p>}
    </form>
  </main>;
}
