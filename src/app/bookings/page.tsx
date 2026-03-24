"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

// --- Types ---

interface Booking {
  id: string;
  source: "form" | "dm";
  status: "new" | "in_progress" | "confirmed" | "completed" | "cancelled";
  plan: "standard" | "premium" | "vip" | null;
  customer_name: string;
  customer_email: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  preferred_area: string | null;
  preferred_genre: string | null;
  party_size: number | null;
  budget_range: string | null;
  special_requests: string | null;
  preferred_store_name: string | null;
  store_id: string | null;
  reservation_date: string | null;
  reservation_time: string | null;
  admin_notes: string | null;
  confirmation_email_sent: boolean;
  created_at: string;
  updated_at: string;
}

interface Store {
  id: string;
  name: string | null;
  name_en: string | null;
  genre: string | null;
  area: string | null;
  price_range: string | null;
  rating: number | null;
  address: string | null;
  address_en: string | null;
  google_maps_url: string | null;
}

interface Alternative {
  store_id: string;
  name: string;
  reason: string;
  store: Store | null;
}

type StatusFilter = "all" | Booking["status"];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<Booking["status"], string> = {
  new: "bg-[#8B2500] text-white",
  in_progress: "bg-[#C4A35A] text-black",
  confirmed: "bg-[#2D6A4F] text-white",
  completed: "bg-[#666] text-white",
  cancelled: "bg-[#444] text-white/70",
};

const PLAN_PRICES: Record<string, number> = {
  standard: 2000,
  premium: 5000,
  vip: 10000,
};

// --- Navigation ---

const NAV_ITEMS = [
  { href: "/upload", label: "Upload" },
  { href: "/review", label: "Review" },
  { href: "/bookings", label: "Bookings" },
  { href: "/stores", label: "Stores" },
  { href: "/analytics", label: "Analytics" },
];

function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-sumi border-r border-white/10 min-h-screen">
      <div className="p-6">
        <Link
          href="/"
          className="font-heading text-xl text-shimofuri tracking-wider"
        >
          WAGYU SAMURAI
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = href === "/bookings";
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                active
                  ? "bg-charcoal-red text-shimofuri"
                  : "text-shimofuri/60 hover:text-shimofuri hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="md:hidden flex items-center gap-1 overflow-x-auto bg-sumi px-4 py-3 border-b border-white/10">
      <Link
        href="/"
        className="font-heading text-lg text-shimofuri tracking-wider mr-4 shrink-0"
      >
        WS
      </Link>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = href === "/bookings";
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
              active
                ? "bg-charcoal-red text-shimofuri"
                : "text-shimofuri/60 hover:text-shimofuri"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// --- Status Badge ---

function StatusBadge({ status }: { status: Booking["status"] }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// --- Source Badge ---

function SourceBadge({ source }: { source: Booking["source"] }) {
  return source === "form" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#2D6A4F]/20 text-[#2D6A4F] border border-[#2D6A4F]/30">
      FORM
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#C4A35A]/20 text-[#C4A35A] border border-[#C4A35A]/30">
      DM
    </span>
  );
}

// --- Add DM Modal ---

function AddDmModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    travel_start_date: "",
    travel_end_date: "",
    preferred_area: "",
    preferred_genre: "",
    party_size: "",
    budget_range: "",
    special_requests: "",
    preferred_store_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: dbError } = await supabase.from("bookings").insert({
      source: "dm",
      status: "new",
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim() || null,
      travel_start_date: form.travel_start_date || null,
      travel_end_date: form.travel_end_date || null,
      preferred_area: form.preferred_area.trim() || null,
      preferred_genre: form.preferred_genre.trim() || null,
      party_size: form.party_size ? parseInt(form.party_size) : null,
      budget_range: form.budget_range.trim() || null,
      special_requests: form.special_requests.trim() || null,
      preferred_store_name: form.preferred_store_name.trim() || null,
    });

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setForm({
      customer_name: "",
      customer_email: "",
      travel_start_date: "",
      travel_end_date: "",
      preferred_area: "",
      preferred_genre: "",
      party_size: "",
      budget_range: "",
      special_requests: "",
      preferred_store_name: "",
    });
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sumi-light border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-heading text-xl text-shimofuri">
            Add DM Request
          </h2>
          <button
            onClick={onClose}
            className="text-shimofuri/40 hover:text-shimofuri text-xl"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field
            label="Customer Name *"
            value={form.customer_name}
            onChange={(v) => updateField("customer_name", v)}
          />
          <Field
            label="Email"
            type="email"
            value={form.customer_email}
            onChange={(v) => updateField("customer_email", v)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Travel Start"
              type="date"
              value={form.travel_start_date}
              onChange={(v) => updateField("travel_start_date", v)}
            />
            <Field
              label="Travel End"
              type="date"
              value={form.travel_end_date}
              onChange={(v) => updateField("travel_end_date", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Preferred Area"
              value={form.preferred_area}
              onChange={(v) => updateField("preferred_area", v)}
              placeholder="e.g. Tokyo, Osaka"
            />
            <Field
              label="Preferred Genre"
              value={form.preferred_genre}
              onChange={(v) => updateField("preferred_genre", v)}
              placeholder="e.g. Yakiniku, Sushi"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Party Size"
              type="number"
              value={form.party_size}
              onChange={(v) => updateField("party_size", v)}
            />
            <Field
              label="Budget Range"
              value={form.budget_range}
              onChange={(v) => updateField("budget_range", v)}
              placeholder="e.g. ¥10,000-20,000"
            />
          </div>
          <Field
            label="Preferred Store"
            value={form.preferred_store_name}
            onChange={(v) => updateField("preferred_store_name", v)}
            placeholder="If any specific store"
          />
          <div>
            <label className="block text-xs text-shimofuri/50 mb-1">
              Special Requests
            </label>
            <textarea
              value={form.special_requests}
              onChange={(e) => updateField("special_requests", e.target.value)}
              rows={3}
              className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red resize-none"
              placeholder="Allergies, celebrations, seating preferences..."
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : "Add Request"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Field Component ---

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-shimofuri/50 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red disabled:opacity-50"
      />
    </div>
  );
}

// --- Email Preview Modal ---

function EmailPreviewModal({
  open,
  onClose,
  subject,
  body,
  to,
  bookingId,
  onSubjectChange,
  onBodyChange,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  to: string;
  bookingId: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          to,
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult("Email sent successfully!");
        onSent();
        setTimeout(() => {
          onClose();
          setResult(null);
        }, 1500);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sumi-light border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-heading text-xl text-shimofuri">
            Email Preview
          </h2>
          <button
            onClick={onClose}
            className="text-shimofuri/40 hover:text-shimofuri text-xl"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-shimofuri/50 mb-1">To</label>
            <p className="text-shimofuri text-sm">{to}</p>
          </div>
          <div>
            <label className="block text-xs text-shimofuri/50 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red"
            />
          </div>
          <div>
            <label className="block text-xs text-shimofuri/50 mb-1">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={16}
              className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red resize-none font-mono text-xs leading-relaxed"
            />
          </div>
          {result && (
            <p
              className={`text-sm ${result.startsWith("Error") ? "text-red-400" : "text-green-400"}`}
            >
              {result}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-shimofuri/60 text-sm hover:text-shimofuri"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-6 py-2 bg-[#2D6A4F] text-white text-sm font-medium rounded-lg hover:bg-[#357B5E] transition-colors disabled:opacity-40"
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Detail Panel ---

function DetailPanel({
  booking,
  stores,
  onClose,
  onUpdated,
}: {
  booking: Booking;
  stores: Store[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(booking.status);
  const [plan, setPlan] = useState<string>(booking.plan || "standard");
  const [storeId, setStoreId] = useState(booking.store_id || "");
  const [reservationDate, setReservationDate] = useState(
    booking.reservation_date || "",
  );
  const [reservationTime, setReservationTime] = useState(
    booking.reservation_time || "",
  );
  const [adminNotes, setAdminNotes] = useState(booking.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Email state
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Alternatives state
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const planPrice = PLAN_PRICES[plan] || 0;
  const totalPrice = planPrice * (booking.party_size || 1);

  const filteredStores = storeSearch
    ? stores.filter(
        (s) =>
          s.name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
          s.name_en?.toLowerCase().includes(storeSearch.toLowerCase()) ||
          s.area?.toLowerCase().includes(storeSearch.toLowerCase()),
      )
    : stores;

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        status,
        plan,
        store_id: storeId || null,
        reservation_date: reservationDate || null,
        reservation_time: reservationTime || null,
        admin_notes: adminNotes.trim() || null,
      })
      .eq("id", booking.id);

    setSaving(false);
    if (!error) onUpdated();
  }

  async function handleGenerateEmail() {
    if (!selectedStore && !storeId) return;
    setGeneratingEmail(true);
    try {
      const res = await fetch("/api/bookings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: booking.customer_name,
          storeName: selectedStore?.name || "TBD",
          storeAddress:
            selectedStore?.address_en || selectedStore?.address || "",
          googleMapsUrl: selectedStore?.google_maps_url || "",
          reservationDate,
          reservationTime,
          partySize: booking.party_size,
          plan,
          specialRequests: booking.special_requests,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSubject(data.email.subject);
        setEmailBody(data.email.body);
        setShowEmailPreview(true);
      }
    } catch {
      // Error handled silently
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function handleSuggestAlternatives() {
    setLoadingAlts(true);
    setAlternatives([]);
    try {
      const res = await fetch("/api/bookings/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: booking.preferred_area,
          genre: booking.preferred_genre,
          priceRange: booking.budget_range,
          partySize: booking.party_size,
          excludeStoreId: storeId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlternatives(data.alternatives);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoadingAlts(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-sumi border-l border-white/10 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-sumi border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl text-shimofuri">
              Booking Detail
            </h2>
            <SourceBadge source={booking.source} />
          </div>
          <button
            onClick={onClose}
            className="text-shimofuri/40 hover:text-shimofuri text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Customer Info
            </h3>
            <div className="bg-sumi-light rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Name</span>
                <span className="text-shimofuri text-sm">
                  {booking.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Email</span>
                <span className="text-shimofuri text-sm">
                  {booking.customer_email || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Travel</span>
                <span className="text-shimofuri text-sm">
                  {booking.travel_start_date && booking.travel_end_date
                    ? `${booking.travel_start_date} → ${booking.travel_end_date}`
                    : booking.travel_start_date || "—"}
                </span>
              </div>
            </div>
          </section>

          {/* Request Details */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Request Details
            </h3>
            <div className="bg-sumi-light rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Area</span>
                <span className="text-shimofuri text-sm">
                  {booking.preferred_area || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Genre</span>
                <span className="text-shimofuri text-sm">
                  {booking.preferred_genre || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Party Size</span>
                <span className="text-shimofuri text-sm">
                  {booking.party_size || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-shimofuri/50 text-xs">Budget</span>
                <span className="text-shimofuri text-sm">
                  {booking.budget_range || "—"}
                </span>
              </div>
              {booking.preferred_store_name && (
                <div className="flex justify-between">
                  <span className="text-shimofuri/50 text-xs">
                    Preferred Store
                  </span>
                  <span className="text-shimofuri text-sm">
                    {booking.preferred_store_name}
                  </span>
                </div>
              )}
              {booking.special_requests && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-shimofuri/50 text-xs block mb-1">
                    Special Requests
                  </span>
                  <p className="text-shimofuri text-sm">
                    {booking.special_requests}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Status & Plan */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Status & Plan
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-shimofuri/50 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Booking["status"])
                  }
                  className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red appearance-none"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-shimofuri/50 mb-1">
                  Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red appearance-none"
                >
                  <option value="standard">Standard (¥2,000/person)</option>
                  <option value="premium">Premium (¥5,000/person)</option>
                  <option value="vip">VIP (¥10,000/person)</option>
                </select>
              </div>
            </div>
            {/* Price calculation */}
            <div className="bg-sumi-light rounded-lg p-4 flex items-center justify-between">
              <span className="text-shimofuri/50 text-sm">Total Fee</span>
              <span className="text-gold font-heading text-lg">
                ¥{planPrice.toLocaleString()} × {booking.party_size || 1}{" "}
                = ¥{totalPrice.toLocaleString()}
              </span>
            </div>
          </section>

          {/* Store Assignment */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Store Assignment
            </h3>
            <div>
              <input
                type="text"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Search stores..."
                className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red mb-2"
              />
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red appearance-none"
                size={Math.min(filteredStores.length + 1, 6)}
              >
                <option value="">— No store assigned —</option>
                {filteredStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.name_en ? `(${s.name_en})` : ""} — {s.area}{" "}
                    {s.genre ? `· ${s.genre}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedStore && (
              <div className="bg-sumi-light rounded-lg p-4 space-y-1 text-sm">
                <p className="text-shimofuri font-medium">
                  {selectedStore.name}
                </p>
                <p className="text-shimofuri/60 text-xs">
                  {selectedStore.address || selectedStore.address_en || "—"}
                </p>
                {selectedStore.google_maps_url && (
                  <a
                    href={selectedStore.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold text-xs hover:underline"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            )}
            <button
              onClick={handleSuggestAlternatives}
              disabled={loadingAlts}
              className="text-sm text-gold hover:underline disabled:opacity-40"
            >
              {loadingAlts ? "Finding alternatives..." : "Suggest alternatives"}
            </button>
            {alternatives.length > 0 && (
              <div className="space-y-2">
                {alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="bg-sumi-light rounded-lg p-3 flex items-start justify-between gap-3 border border-white/5 hover:border-gold/30 cursor-pointer transition-colors"
                    onClick={() => {
                      if (alt.store_id) setStoreId(alt.store_id);
                      setAlternatives([]);
                    }}
                  >
                    <div>
                      <p className="text-shimofuri text-sm font-medium">
                        {alt.name}
                      </p>
                      <p className="text-shimofuri/50 text-xs mt-0.5">
                        {alt.reason}
                      </p>
                      {alt.store && (
                        <p className="text-shimofuri/40 text-[10px] mt-1">
                          {alt.store.area} · {alt.store.genre} ·{" "}
                          {alt.store.price_range}
                        </p>
                      )}
                    </div>
                    <span className="text-gold text-xs shrink-0">Select</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reservation Date/Time */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Reservation Date & Time
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Date"
                type="date"
                value={reservationDate}
                onChange={setReservationDate}
              />
              <Field
                label="Time"
                type="time"
                value={reservationTime}
                onChange={setReservationTime}
              />
            </div>
          </section>

          {/* Admin Notes */}
          <section className="space-y-3">
            <h3 className="text-xs text-gold uppercase tracking-wider font-medium">
              Taisei Memo
            </h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              className="w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red resize-none"
              placeholder="Internal notes..."
            />
          </section>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleGenerateEmail}
              disabled={generatingEmail || !storeId}
              className="w-full py-3 bg-[#2D6A4F] text-white text-sm font-medium rounded-lg hover:bg-[#357B5E] transition-colors disabled:opacity-40"
            >
              {generatingEmail
                ? "Generating email..."
                : "Generate Confirmation Email"}
            </button>
            {booking.confirmation_email_sent && (
              <p className="text-center text-green-400/80 text-xs">
                Confirmation email already sent
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        open={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        subject={emailSubject}
        body={emailBody}
        to={booking.customer_email || ""}
        bookingId={booking.id}
        onSubjectChange={setEmailSubject}
        onBodyChange={setEmailBody}
        onSent={onUpdated}
      />
    </>
  );
}

// --- Main Bookings Page ---

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showAddDm, setShowAddDm] = useState(false);

  const fetchBookings = useCallback(async () => {
    let query = supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    if (data) setBookings(data);
  }, [filter]);

  const fetchStores = useCallback(async () => {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .order("name", { ascending: true });
    if (data) setStores(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchBookings(), fetchStores()]).then(() => setLoading(false));
  }, [fetchBookings, fetchStores]);

  function handleUpdated() {
    fetchBookings();
    // Refresh selected booking if still open
    if (selectedBooking) {
      supabase
        .from("bookings")
        .select("*")
        .eq("id", selectedBooking.id)
        .single()
        .then(({ data }) => {
          if (data) setSelectedBooking(data);
        });
    }
  }

  const filteredBookings = bookings;

  // Keyboard: ESC to close panels
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showAddDm) setShowAddDm(false);
        else if (selectedBooking) setSelectedBooking(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showAddDm, selectedBooking]);

  return (
    <div className="flex min-h-screen bg-sumi">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <MobileNav />

        {/* Header */}
        <header className="px-6 pt-8 pb-4 md:px-10 md:pt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-shimofuri tracking-wide">
              Booking Manager
            </h1>
            <p className="text-shimofuri/40 text-sm mt-1">
              Manage reservation requests and confirmations
            </p>
          </div>
          <button
            onClick={() => setShowAddDm(true)}
            className="px-5 py-2.5 bg-[#C4A35A] text-black text-sm font-medium rounded-lg hover:bg-[#D4B36A] transition-colors shrink-0"
          >
            + Add DM Request
          </button>
        </header>

        {/* Status Filter Tabs */}
        <div className="px-6 md:px-10 mb-4">
          <div className="flex gap-1 overflow-x-auto">
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  filter === value
                    ? "bg-charcoal-red text-shimofuri"
                    : "text-shimofuri/50 hover:text-shimofuri hover:bg-white/5"
                }`}
              >
                {label}
                {value === "all" && !loading && (
                  <span className="ml-1.5 text-shimofuri/30 text-xs">
                    {bookings.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Booking Table */}
        <main className="flex-1 px-6 pb-12 md:px-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-shimofuri/40 text-sm">
                No bookings found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider hidden md:table-cell">
                      Travel Dates
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider hidden lg:table-cell">
                      Area
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">
                      Guests
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider hidden lg:table-cell">
                      Plan
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">
                      Source
                    </th>
                    <th className="text-left py-3 px-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider hidden md:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className="border-b border-white/5 bg-sumi-light hover:bg-[#333] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="py-3 px-3 text-shimofuri">
                        {b.customer_name}
                      </td>
                      <td className="py-3 px-3 text-shimofuri/60 hidden md:table-cell">
                        {b.travel_start_date
                          ? `${b.travel_start_date}${b.travel_end_date ? ` → ${b.travel_end_date}` : ""}`
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-shimofuri/60 hidden lg:table-cell">
                        {b.preferred_area || "—"}
                      </td>
                      <td className="py-3 px-3 text-shimofuri/60">
                        {b.party_size || "—"}
                      </td>
                      <td className="py-3 px-3 text-shimofuri/60 capitalize hidden lg:table-cell">
                        {b.plan || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <SourceBadge source={b.source} />
                      </td>
                      <td className="py-3 px-3 text-shimofuri/40 text-xs hidden md:table-cell">
                        {new Date(b.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Detail Panel */}
      {selectedBooking && (
        <DetailPanel
          booking={selectedBooking}
          stores={stores}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Add DM Modal */}
      <AddDmModal
        open={showAddDm}
        onClose={() => setShowAddDm(false)}
        onCreated={fetchBookings}
      />
    </div>
  );
}
