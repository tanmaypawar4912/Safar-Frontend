import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  RefreshCw,
  Star,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import api from "../../services/api";

interface DriverReview {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  customer?: { name?: string } | string | null;
  booking?: { bookingCode?: string; status?: string } | string | null;
}

interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const formatDate = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function getError(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return "Your session may have expired. Please sign in again.";
    }
    if (error.response?.status === 403) {
      return error.response?.data?.message ||
        "This account cannot view driver reviews.";
    }

    return error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Cannot connect to LogiGo. Check that the backend is running."
        : "Unable to load customer reviews.");
  }

  return error instanceof Error
    ? error.message
    : "Unable to load customer reviews.";
}

function customerName(value: DriverReview["customer"]) {
  if (value && typeof value === "object") {
    return value.name || "LogiGo customer";
  }
  return "LogiGo customer";
}

function bookingCode(value: DriverReview["booking"]) {
  if (value && typeof value === "object") {
    return value.bookingCode || "Delivery booking";
  }
  return "Delivery booking";
}

export default function DriverReviews() {
  const [reviews, setReviews] = useState<DriverReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({
    totalReviews: 0,
    averageRating: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReviews = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reviews/driver/mine", {
        params: { page: targetPage, limit: 10 },
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || "Unable to load customer reviews."
        );
      }

      setReviews(
        Array.isArray(response.data.reviews)
          ? response.data.reviews
          : []
      );

      setSummary({
        totalReviews: Number(response.data?.summary?.totalReviews || 0),
        averageRating: Number(response.data?.summary?.averageRating || 0),
      });

      setPagination(
        response.data?.pagination || {
          page: targetPage,
          limit: 10,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (requestError: unknown) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadReviews(page);
  }, [loadReviews, page]);

  function goToPage(nextPage: number) {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page
    ) {
      return;
    }
    setPage(nextPage);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-5 text-slate-900 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#101c30] via-[#172943] to-[#28272e] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-300 sm:text-xs">
            <Star className="h-4 w-4" />
            Driver workspace / feedback
          </span>

          <div className="relative mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-tight">
                Reviews received
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Read customer feedback from deliveries assigned to you and
                track your overall rating.
              </p>
            </div>

            <Link
              to="/driver"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Overview
            </Link>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-300">Total reviews</p>
                <MessageSquareText className="h-5 w-5 text-orange-300" />
              </div>
              <p className="mt-3 text-4xl font-black tabular-nums">
                {loading ? "—" : summary.totalReviews}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Reviews connected to your completed bookings
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-300">
                  Average customer rating
                </p>
                <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
              </div>
              <p className="mt-3 flex items-baseline gap-2 text-4xl font-black tabular-nums">
                {loading ? "—" : summary.averageRating.toFixed(1)}
                <span className="text-base font-bold text-slate-400">/ 5</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Calculated from all reviews received
              </p>
            </article>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadReviews(page)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 font-bold hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-black sm:text-xl">Customer feedback</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pagination.total} review{pagination.total === 1 ? "" : "s"} on record.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadReviews(page)}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="px-5 py-12 text-center sm:py-16">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Star className="h-7 w-7" />
              </span>
              <h3 className="mt-4 text-lg font-black">No reviews yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Customer reviews will appear here after customers review
                deliveries assigned to you.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviews.map((review) => (
                <article key={review._id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101c30] text-white">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm font-black text-slate-900">
                          {customerName(review.customer)}
                        </h3>
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                          {bookingCode(review.booking)}
                        </span>
                      </div>
                      {review.title && (
                        <p className="mt-3 text-base font-extrabold text-slate-800">
                          {review.title}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs font-extrabold text-slate-700">
                      {review.rating}/5
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                    {review.comment}
                  </p>
                </article>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs font-medium text-slate-500">
                Page {page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => goToPage(page - 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-bold disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => goToPage(page + 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-bold disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}