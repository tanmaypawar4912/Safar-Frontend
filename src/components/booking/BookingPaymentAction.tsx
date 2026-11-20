import { useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import api from "../../services/api";

type Props = {
  bookingId: string;
  bookingCode: string;
  paymentMethod?: string;
  paymentStatus: string;
  amount: number;
  customerName?: string;
  onPaid: () => void | Promise<void>;
};

type OrderResponse = {
  success: boolean;
  keyId: string;
  order: { id: string; amount: number; currency: string };
  bookingCode: string;
  customerName?: string;
  alreadyPaid?: boolean;
  message?: string;
};

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let checkoutScriptPromise: Promise<boolean> | null = null;

function loadRazorpayCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src=\"${CHECKOUT_SCRIPT}\"]`);
    const script = existing || document.createElement("script");
    const finish = (ready: boolean) => resolve(ready && typeof window.Razorpay === "function");
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    if (!existing) {
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    } else if (window.Razorpay) {
      finish(true);
    }
  }).finally(() => {
    if (!window.Razorpay) checkoutScriptPromise = null;
  });
  return checkoutScriptPromise;
}

export default function BookingPaymentAction({
  bookingId, bookingCode, paymentMethod, paymentStatus, amount, customerName, onPaid,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (paymentStatus === "paid") {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status">
        <div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Payment received</div>
        <p className="mt-1 text-sm text-emerald-700">Your payment for {bookingCode} has been recorded.</p>
      </section>
    );
  }

  if (paymentMethod !== "online" || paymentStatus === "paid") return null;

  async function startPayment() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await api.post<OrderResponse>(`/payments/${bookingId}/order`);
      const order = response.data;
      if (order.alreadyPaid) { await onPaid(); return; }
      if (!order.success || !order.keyId || !order.order?.id) {
        throw new Error(order.message || "Payment gateway did not return a valid order.");
      }

      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error("Razorpay Checkout could not load. Check your internet connection and retry.");
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.order.amount,
        currency: order.order.currency || "INR",
        name: "LogiGo",
        description: `Delivery payment · ${order.bookingCode || bookingCode}`,
        order_id: order.order.id,
        prefill: { name: order.customerName || customerName },
        notes: { bookingCode: order.bookingCode || bookingCode },
        theme: { color: "#f97316" },
        modal: { ondismiss: () => setNotice("Checkout closed. Your booking remains unpaid until payment is verified.") },
        handler: async (payment) => {
          try {
            setBusy(true); setError(""); setNotice("Verifying payment securely…");
            const verified = await api.post(`/payments/${bookingId}/verify`, {
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            if (!verified.data?.success) throw new Error(verified.data?.message || "Payment verification failed.");
            setNotice("Payment verified successfully.");
            await onPaid();
          } catch (verificationError) {
            const candidate = verificationError as { response?: { data?: { message?: string } }; message?: string };
            setError(candidate.response?.data?.message || candidate.message || "Unable to verify payment. Please refresh the booking before retrying.");
            setNotice("");
          } finally { setBusy(false); }
        },
      });
      checkout.on("payment.failed", (failure) => {
        const candidate = failure as { error?: { description?: string } };
        setError(candidate.error?.description || "Payment failed. You can retry from this booking.");
        setNotice("");
      });
      checkout.open();
    } catch (paymentError) {
      const candidate = paymentError as { response?: { data?: { message?: string } }; message?: string };
      setError(candidate.response?.data?.message || candidate.message || "Unable to start payment.");
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600"><CreditCard className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-slate-900">Online payment</h3>
          <p className="mt-1 text-sm text-slate-600">Pay the final delivery amount securely through Razorpay.</p>
          <p className="mt-2 text-lg font-black text-slate-900">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0)}</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
      <button type="button" onClick={() => void startPayment()} disabled={busy} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {busy ? "Processing…" : "Pay now"}
      </button>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">Payment is marked paid only after LogiGo verifies the Razorpay signature and confirms the captured amount with the gateway.</p>
    </section>
  );
}
