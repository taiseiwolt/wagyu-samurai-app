"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// --- Types ---

interface AnalyticsSnapshot {
  id: string;
  date: string;
  ig_followers: number | null;
  ghost_pageviews: number | null;
  medium_views: number | null;
  created_at: string;
}

interface Booking {
  id: string;
  status: string;
  plan: string | null;
  party_size: number | null;
  created_at: string;
}

interface MonthlyFollowers {
  month: string;
  ig_followers: number;
}

interface MonthlyBookings {
  month: string;
  requests: number;
  confirmed: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

// --- Constants ---

const PLAN_RATES: Record<string, number> = {
  standard: 1500,
  premium: 2000,
  vip: 3000,
};

const CHART_COLORS = {
  primary: "#8B2500",
  gold: "#C4A35A",
  grid: "#333",
  text: "#999",
  tooltipBg: "#2A2A2A",
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
          const active = href === "/analytics";
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
        const active = href === "/analytics";
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

// --- Helpers ---

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString()}`;
}

function calcRevenue(booking: Booking): number {
  const rate = PLAN_RATES[booking.plan || "standard"] || 1500;
  return rate * (booking.party_size || 1);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// --- Custom Tooltip ---

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg border border-white/10"
      style={{ backgroundColor: CHART_COLORS.tooltipBg }}
    >
      <p className="text-xs text-white/60 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

// --- Main Page ---

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [igFollowers, setIgFollowers] = useState("");
  const [ghostPageviews, setGhostPageviews] = useState("");
  const [mediumViews, setMediumViews] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [snapRes, bookRes] = await Promise.all([
      supabase
        .from("analytics_snapshots")
        .select("*")
        .order("date", { ascending: true }),
      supabase
        .from("bookings")
        .select("id, status, plan, party_size, created_at")
        .order("created_at", { ascending: true }),
    ]);
    setSnapshots(snapRes.data || []);
    setBookings(bookRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived data ---

  const now = new Date();
  const currentMonthKey = getMonthKey(now.toISOString());
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKey(prevMonth.toISOString());

  // Latest snapshot
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  // Previous month snapshot (latest entry from prev month)
  const prevMonthSnapshots = snapshots.filter(
    (s) => getMonthKey(s.date) === prevMonthKey,
  );
  const prevSnapshot =
    prevMonthSnapshots.length > 0
      ? prevMonthSnapshots[prevMonthSnapshots.length - 1]
      : null;

  // Booking counts
  const currentMonthBookings = bookings.filter(
    (b) => getMonthKey(b.created_at) === currentMonthKey,
  );
  const prevMonthBookingsList = bookings.filter(
    (b) => getMonthKey(b.created_at) === prevMonthKey,
  );

  const currentRequests = currentMonthBookings.length;
  const prevRequests = prevMonthBookingsList.length;

  const currentConfirmed = currentMonthBookings.filter(
    (b) => b.status === "confirmed",
  ).length;

  // Revenue
  const currentRevenue = currentMonthBookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + calcRevenue(b), 0);
  const prevRevenue = prevMonthBookingsList
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + calcRevenue(b), 0);

  // Pageviews
  const currentPageviews =
    (latestSnapshot?.ghost_pageviews || 0) + (latestSnapshot?.medium_views || 0);
  const prevPageviews =
    (prevSnapshot?.ghost_pageviews || 0) + (prevSnapshot?.medium_views || 0);

  // --- Chart data ---

  // Followers chart
  const followersData: MonthlyFollowers[] = [];
  const followersByMonth = new Map<string, number>();
  for (const s of snapshots) {
    if (s.ig_followers != null) {
      followersByMonth.set(getMonthKey(s.date), s.ig_followers);
    }
  }
  for (const [month, ig_followers] of followersByMonth) {
    followersData.push({ month: formatMonthLabel(month), ig_followers });
  }

  // Bookings chart
  const bookingsByMonth = new Map<string, { requests: number; confirmed: number }>();
  for (const b of bookings) {
    const mk = getMonthKey(b.created_at);
    const entry = bookingsByMonth.get(mk) || { requests: 0, confirmed: 0 };
    entry.requests++;
    if (b.status === "confirmed") entry.confirmed++;
    bookingsByMonth.set(mk, entry);
  }
  const bookingsData: MonthlyBookings[] = Array.from(bookingsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: formatMonthLabel(month),
      ...data,
    }));

  // Revenue chart
  const revenueByMonth = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "confirmed") {
      const mk = getMonthKey(b.created_at);
      revenueByMonth.set(mk, (revenueByMonth.get(mk) || 0) + calcRevenue(b));
    }
  }
  const revenueData: MonthlyRevenue[] = Array.from(revenueByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({
      month: formatMonthLabel(month),
      revenue,
    }));

  // Conversion rate
  const totalRequests = bookings.length;
  const totalConfirmed = bookings.filter((b) => b.status === "confirmed").length;
  const conversionRate =
    totalRequests > 0 ? Math.round((totalConfirmed / totalRequests) * 100) : 0;
  const conversionData = [
    { name: "Confirmed", value: totalConfirmed },
    { name: "Other", value: totalRequests - totalConfirmed },
  ];

  // --- Save snapshot ---

  async function handleSaveSnapshot() {
    if (!igFollowers && !ghostPageviews && !mediumViews) return;
    setSaving(true);

    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("analytics_snapshots").insert({
      date: today,
      ig_followers: igFollowers ? parseInt(igFollowers) : null,
      ghost_pageviews: ghostPageviews ? parseInt(ghostPageviews) : null,
      medium_views: mediumViews ? parseInt(mediumViews) : null,
    });

    setSaving(false);
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast("Stats recorded successfully");
      setModalOpen(false);
      setIgFollowers("");
      setGhostPageviews("");
      setMediumViews("");
      fetchData();
    }
    setTimeout(() => setToast(null), 4000);
  }

  // --- KPI Cards ---

  const kpiCards = [
    {
      label: "IG Followers",
      value: latestSnapshot?.ig_followers ?? 0,
      format: (v: number) => v.toLocaleString(),
      change: pctChange(
        latestSnapshot?.ig_followers ?? 0,
        prevSnapshot?.ig_followers ?? 0,
      ),
      borderColor: "#8B2500",
    },
    {
      label: "Total Pageviews",
      value: currentPageviews,
      format: (v: number) => v.toLocaleString(),
      change: pctChange(currentPageviews, prevPageviews),
      borderColor: "#C4A35A",
    },
    {
      label: "Booking Requests",
      value: currentRequests,
      format: (v: number) => v.toLocaleString(),
      change: pctChange(currentRequests, prevRequests),
      borderColor: "#2D6A4F",
    },
    {
      label: "Revenue",
      value: currentRevenue,
      format: formatYen,
      change: pctChange(currentRevenue, prevRevenue),
      borderColor: "#F5F0EB",
    },
  ];

  // --- Render ---

  return (
    <div className="flex min-h-screen bg-sumi">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <MobileNav />

        {/* Header */}
        <header className="px-6 pt-8 pb-4 md:px-10 md:pt-10 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-shimofuri tracking-wide">
              Analytics
            </h1>
            <p className="text-shimofuri/40 text-sm mt-1">
              KPI dashboard &amp; performance tracking
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors shrink-0"
          >
            Record Stats
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pb-12 md:px-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                  <div
                    key={card.label}
                    className="bg-sumi-light rounded-xl p-5 border-t-2"
                    style={{ borderTopColor: card.borderColor }}
                  >
                    <p className="text-shimofuri/50 text-xs uppercase tracking-wider mb-2">
                      {card.label}
                    </p>
                    <p className="font-heading text-2xl md:text-3xl text-shimofuri font-light">
                      {card.format(card.value)}
                    </p>
                    {card.change !== null && (
                      <p
                        className="text-xs mt-1 font-medium"
                        style={{
                          color:
                            card.change >= 0 ? "#2D6A4F" : "#8B2500",
                        }}
                      >
                        {card.change >= 0 ? "↑" : "↓"} {Math.abs(card.change)}%
                        vs last month
                      </p>
                    )}
                    {card.change === null && (
                      <p className="text-xs mt-1 text-shimofuri/30">No prior data</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Followers Chart */}
                <section className="bg-sumi-light rounded-xl p-6">
                  <h2 className="text-sm font-medium text-gold uppercase tracking-wider mb-4">
                    Followers Trend
                  </h2>
                  <div className="h-64">
                    {followersData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={followersData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                          />
                          <YAxis
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                          />
                          <Tooltip
                            content={<ChartTooltip />}
                          />
                          <Line
                            type="monotone"
                            dataKey="ig_followers"
                            name="IG Followers"
                            stroke={CHART_COLORS.primary}
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS.primary, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-shimofuri/30 text-sm">
                          No follower data yet
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Bookings Chart */}
                <section className="bg-sumi-light rounded-xl p-6">
                  <h2 className="text-sm font-medium text-gold uppercase tracking-wider mb-4">
                    Bookings by Month
                  </h2>
                  <div className="h-64">
                    {bookingsData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bookingsData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                          />
                          <YAxis
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                          />
                          <Tooltip
                            content={<ChartTooltip />}
                          />
                          <Bar
                            dataKey="requests"
                            name="Requests"
                            fill={CHART_COLORS.primary}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="confirmed"
                            name="Confirmed"
                            fill={CHART_COLORS.gold}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-shimofuri/30 text-sm">
                          No booking data yet
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <section className="bg-sumi-light rounded-xl p-6">
                  <h2 className="text-sm font-medium text-gold uppercase tracking-wider mb-4">
                    Revenue Trend
                  </h2>
                  <div className="h-64">
                    {revenueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={CHART_COLORS.grid}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                          />
                          <YAxis
                            tick={{ fill: CHART_COLORS.text, fontSize: 12 }}
                            axisLine={{ stroke: CHART_COLORS.grid }}
                            tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            content={<ChartTooltip formatter={formatYen} />}
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Revenue"
                            stroke={CHART_COLORS.gold}
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS.gold, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-shimofuri/30 text-sm">
                          No revenue data yet
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Conversion Rate */}
                <section className="bg-sumi-light rounded-xl p-6">
                  <h2 className="text-sm font-medium text-gold uppercase tracking-wider mb-4">
                    Booking Conversion Rate
                  </h2>
                  <div className="h-64 flex items-center justify-center">
                    {totalRequests > 0 ? (
                      <div className="flex items-center gap-8">
                        <div className="w-40 h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={conversionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                              >
                                <Cell fill={CHART_COLORS.gold} />
                                <Cell fill={CHART_COLORS.grid} />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          <p className="font-heading text-4xl text-shimofuri font-light">
                            {conversionRate}%
                          </p>
                          <p className="text-shimofuri/50 text-xs">
                            {totalConfirmed} confirmed / {totalRequests} total
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <span
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: CHART_COLORS.gold }}
                            />
                            <span className="text-shimofuri/60 text-xs">
                              Confirmed
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: CHART_COLORS.grid }}
                            />
                            <span className="text-shimofuri/60 text-xs">
                              Pending / Cancelled
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-shimofuri/30 text-sm">
                        No booking data yet
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Record Stats Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-sumi-light rounded-xl p-6 w-full max-w-md mx-4 space-y-5 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-shimofuri">
                Record Today&apos;s Stats
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-shimofuri/40 hover:text-shimofuri text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-shimofuri/50 uppercase tracking-wider block mb-1.5">
                  IG Followers
                </label>
                <input
                  type="number"
                  value={igFollowers}
                  onChange={(e) => setIgFollowers(e.target.value)}
                  placeholder="e.g. 12500"
                  className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-shimofuri/50 uppercase tracking-wider block mb-1.5">
                  Ghost Pageviews
                </label>
                <input
                  type="number"
                  value={ghostPageviews}
                  onChange={(e) => setGhostPageviews(e.target.value)}
                  placeholder="e.g. 3200"
                  className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-shimofuri/50 uppercase tracking-wider block mb-1.5">
                  Medium Views
                </label>
                <input
                  type="number"
                  value={mediumViews}
                  onChange={(e) => setMediumViews(e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSnapshot}
              disabled={saving || (!igFollowers && !ghostPageviews && !mediumViews)}
              className="w-full py-3 bg-charcoal-red text-shimofuri font-medium rounded-lg hover:bg-[#A63000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sumi-light border border-white/10 px-6 py-3 rounded-xl shadow-2xl z-50">
          <p className="text-shimofuri text-sm">{toast}</p>
        </div>
      )}
    </div>
  );
}
