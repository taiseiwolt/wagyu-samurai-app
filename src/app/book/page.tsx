"use client";

import { useState } from "react";

const AREAS = ["Tokyo", "Kyoto", "Osaka", "No preference"] as const;
const CUISINES = [
  "Wagyu steak",
  "Yakiniku",
  "Sukiyaki & Shabu-shabu",
  "Any",
] as const;
const BUDGETS = [
  "Under ¥10,000",
  "¥10,000-20,000",
  "Over ¥20,000",
  "No limit",
] as const;

interface FormData {
  name: string;
  email: string;
  arrival_date: string;
  departure_date: string;
  preferred_area: string;
  cuisine_type: string;
  party_size: number;
  budget_per_person: string;
  special_requests: string;
  preferred_restaurant: string;
}

export default function BookPage() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    arrival_date: "",
    departure_date: "",
    preferred_area: "",
    cuisine_type: "",
    party_size: 2,
    budget_per_person: "",
    special_requests: "",
    preferred_restaurant: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  function update(field: keyof FormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.departure_date <= form.arrival_date) {
      setError("Departure date must be after arrival date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-sumi flex items-center justify-center px-4">
        <div className="max-w-[600px] w-full text-center space-y-6 py-16">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-shimofuri">
            WAGYU SAMURAI
          </h1>
          <div className="w-16 h-px bg-charcoal-red mx-auto" />
          <div className="bg-sumi-light rounded-lg p-8 space-y-4">
            <div className="text-gold text-5xl">&#10003;</div>
            <h2 className="font-heading text-2xl text-shimofuri">
              Thank you!
            </h2>
            <p className="text-shimofuri/80 text-sm leading-relaxed">
              I&apos;ll review your request and get back to you within 24 hours.
            </p>
            <p className="text-shimofuri/60 text-sm">
              Check your email for a confirmation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sumi py-10 px-4">
      <div className="max-w-[600px] mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-shimofuri">
            WAGYU SAMURAI
          </h1>
          <p className="text-shimofuri/60 text-xs tracking-[3px] uppercase font-body">
            Hand-picked. If it&apos;s here, it&apos;s worth it. Taste over
            trends.
          </p>
          <div className="w-16 h-px bg-charcoal-red mx-auto" />
        </header>

        {/* Pricing info */}
        <div className="bg-sumi-light rounded-lg p-5 space-y-2 border border-gold/20">
          <p className="text-gold text-[10px] tracking-[2px] uppercase font-body font-medium">
            Reservation Fee
          </p>
          <ul className="text-shimofuri/80 text-sm space-y-1 font-body">
            <li>
              <span className="text-shimofuri">Standard</span> &mdash; ¥1,500
              per person
            </li>
            <li>
              <span className="text-shimofuri">Premium</span> (hard-to-book)
              &mdash; ¥2,000 per person
            </li>
            <li>
              <span className="text-shimofuri">VIP</span> (special requests)
              &mdash; ¥3,000 per person
            </li>
          </ul>
          <p className="text-shimofuri/40 text-xs">
            Tier is determined after review based on restaurant and request
            complexity.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Your full name"
              className="form-input"
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="form-input"
            />
          </Field>

          <Field label="Travel Dates" required>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-shimofuri/50 text-xs block mb-1">
                  Arrival
                </span>
                <input
                  type="date"
                  required
                  min={today}
                  value={form.arrival_date}
                  onChange={(e) => update("arrival_date", e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <span className="text-shimofuri/50 text-xs block mb-1">
                  Departure
                </span>
                <input
                  type="date"
                  required
                  min={form.arrival_date || today}
                  value={form.departure_date}
                  onChange={(e) => update("departure_date", e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </Field>

          <Field label="Preferred Area" required>
            <select
              required
              value={form.preferred_area}
              onChange={(e) => update("preferred_area", e.target.value)}
              className="form-input"
            >
              <option value="">Select area</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cuisine Type" required>
            <select
              required
              value={form.cuisine_type}
              onChange={(e) => update("cuisine_type", e.target.value)}
              className="form-input"
            >
              <option value="">Select cuisine</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Party Size" required>
            <input
              type="number"
              required
              min={1}
              max={20}
              value={form.party_size}
              onChange={(e) => update("party_size", parseInt(e.target.value) || 2)}
              className="form-input"
            />
          </Field>

          <Field label="Budget per Person" required>
            <select
              required
              value={form.budget_per_person}
              onChange={(e) => update("budget_per_person", e.target.value)}
              className="form-input"
            >
              <option value="">Select budget</option>
              {BUDGETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Special Requests">
            <textarea
              rows={3}
              value={form.special_requests}
              onChange={(e) => update("special_requests", e.target.value)}
              placeholder="Allergies, anniversaries, private room, dress code, etc."
              className="form-input resize-none"
            />
          </Field>

          <Field label="Preferred Restaurant">
            <input
              type="text"
              value={form.preferred_restaurant}
              onChange={(e) => update("preferred_restaurant", e.target.value)}
              placeholder="If you have a specific restaurant in mind"
              className="form-input"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm font-body">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-charcoal-red text-shimofuri font-body font-medium text-sm tracking-[1px] uppercase rounded-lg hover:bg-charcoal-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? "Submitting..." : "Request a Table"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-gold text-[10px] tracking-[2px] uppercase font-body font-medium block">
        {label}
        {required && <span className="text-charcoal-red ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
