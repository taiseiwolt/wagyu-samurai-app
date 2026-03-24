"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

// --- Types ---

interface Store {
  id: string;
  name: string | null;
  name_en: string | null;
  tabelog_url: string | null;
  genre: string | null;
  area: string | null;
  price_range: string | null;
  rating: number | null;
  address: string | null;
  address_en: string | null;
  phone: string | null;
  hours: string | null;
  google_maps_url: string | null;
  booking_difficulty: string | null;
  taisei_notes: string | null;
  booking_count: number;
  created_at: string;
}

interface Post {
  id: string;
  status: string;
  memo: string | null;
  created_at: string;
  ghost_post_id: string | null;
}

interface Booking {
  id: string;
  customer_name: string | null;
  date: string | null;
  party_size: number | null;
  status: string | null;
  created_at: string;
}

type ViewMode = "card" | "table";
type SortKey = "rating" | "booking_count" | "created_at";
type BookingDifficulty = "Easy" | "Phone Required" | "Difficult" | "CC Required";

const AREAS = ["All", "Tokyo", "Kyoto", "Osaka"] as const;
const GENRES = ["All", "Wagyu Steak", "Yakiniku", "Sukiyaki", "Other"] as const;
const DIFFICULTIES = ["All", "Easy", "Phone Required", "Difficult", "CC Required"] as const;
const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-[#2D6A4F] text-white",
  "Phone Required": "bg-[#C4A35A] text-sumi",
  Difficult: "bg-[#8B2500] text-white",
  "CC Required": "bg-[#666] text-white",
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
        <Link href="/" className="font-heading text-xl text-shimofuri tracking-wider">
          WAGYU SAMURAI
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = href === "/stores";
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
        const active = href === "/stores";
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

// --- Difficulty Badge ---

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null;
  const color = DIFFICULTY_COLORS[difficulty] || "bg-white/10 text-shimofuri/60";
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${color}`}>
      {difficulty}
    </span>
  );
}

// --- Add Store Modal ---

function AddStoreModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (store: Store) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    name_en: "",
    area: "Tokyo",
    genre: "Wagyu Steak",
    price_range: "",
    address: "",
    phone: "",
    booking_difficulty: "Easy" as BookingDifficulty,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Store name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: dbErr } = await supabase
      .from("stores")
      .insert({
        name: form.name.trim(),
        name_en: form.name_en.trim() || null,
        area: form.area,
        genre: form.genre,
        price_range: form.price_range.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        booking_difficulty: form.booking_difficulty,
      })
      .select()
      .single();
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onCreated({ ...data, booking_count: 0 } as Store);
    onClose();
    setForm({
      name: "",
      name_en: "",
      area: "Tokyo",
      genre: "Wagyu Steak",
      price_range: "",
      address: "",
      phone: "",
      booking_difficulty: "Easy",
    });
  }

  if (!open) return null;

  const inputCls =
    "w-full bg-sumi border border-white/10 rounded-lg px-4 py-2.5 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors";
  const labelCls = "text-shimofuri/60 text-xs mb-1 block";
  const selectCls =
    "w-full bg-sumi border border-white/10 rounded-lg px-4 py-2.5 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-sumi-light border border-white/10 rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl text-shimofuri">Add Store</h2>
          <button onClick={onClose} className="text-shimofuri/40 hover:text-shimofuri text-lg">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Store Name (Japanese) *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="店名" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Store Name (English)</label>
            <input className={inputCls} value={form.name_en} onChange={(e) => set("name_en", e.target.value)} placeholder="English name" />
          </div>
          <div>
            <label className={labelCls}>Area</label>
            <select className={selectCls} value={form.area} onChange={(e) => set("area", e.target.value)}>
              {AREAS.filter((a) => a !== "All").map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Genre</label>
            <select className={selectCls} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
              {GENRES.filter((g) => g !== "All").map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Price Range</label>
            <input className={inputCls} value={form.price_range} onChange={(e) => set("price_range", e.target.value)} placeholder="¥10,000〜¥20,000" />
          </div>
          <div>
            <label className={labelCls}>Booking Difficulty</label>
            <select className={selectCls} value={form.booking_difficulty} onChange={(e) => set("booking_difficulty", e.target.value)}>
              {DIFFICULTIES.filter((d) => d !== "All").map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address</label>
            <input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="住所" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="03-xxxx-xxxx" />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 text-shimofuri/60 text-sm hover:text-shimofuri transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : "Add Store"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Store Detail Panel ---

function StoreDetail({
  store,
  onClose,
  onUpdate,
}: {
  store: Store;
  onClose: () => void;
  onUpdate: (updated: Store) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...store });
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...store });
    setEditing(false);
    setNewNote("");
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  async function loadRelated() {
    setLoading(true);
    const [postsRes, bookingsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, status, memo, created_at, ghost_post_id")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("id, customer_name, date, party_size, status, created_at")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
    ]);
    setPosts((postsRes.data as Post[]) || []);
    setBookings((bookingsRes.data as Booking[]) || []);
    setLoading(false);
  }

  async function handleSaveEdit() {
    setSaving(true);
    const { error } = await supabase
      .from("stores")
      .update({
        name: form.name,
        name_en: form.name_en,
        tabelog_url: form.tabelog_url,
        genre: form.genre,
        area: form.area,
        price_range: form.price_range,
        address: form.address,
        address_en: form.address_en,
        phone: form.phone,
        hours: form.hours,
        google_maps_url: form.google_maps_url,
        booking_difficulty: form.booking_difficulty,
      })
      .eq("id", store.id);
    setSaving(false);
    if (!error) {
      onUpdate({ ...store, ...form });
      setEditing(false);
    }
  }

  async function handleDifficultyChange(val: string) {
    setForm((prev) => ({ ...prev, booking_difficulty: val }));
    await supabase.from("stores").update({ booking_difficulty: val }).eq("id", store.id);
    onUpdate({ ...store, booking_difficulty: val });
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    const date = new Date().toLocaleDateString("ja-JP");
    const existing = store.taisei_notes || "";
    const updated = existing ? `${existing}\n\n[${date}]\n${newNote.trim()}` : `[${date}]\n${newNote.trim()}`;
    await supabase.from("stores").update({ taisei_notes: updated }).eq("id", store.id);
    onUpdate({ ...store, taisei_notes: updated });
    setNewNote("");
  }

  const inputCls =
    "w-full bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors";
  const labelCls = "text-shimofuri/40 text-xs";

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-xl bg-sumi border-l border-white/10 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-sumi/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-heading text-xl text-shimofuri truncate pr-4">
            {store.name || "Unknown"}
          </h2>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gold hover:underline"
              >
                Edit
              </button>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setForm({ ...store }); }} className="text-xs text-shimofuri/40 hover:text-shimofuri">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="text-xs bg-charcoal-red text-shimofuri px-3 py-1 rounded hover:bg-[#A63000] disabled:opacity-40"
                >
                  {saving ? "..." : "Save"}
                </button>
              </>
            )}
            <button onClick={onClose} className="text-shimofuri/40 hover:text-shimofuri ml-2 text-lg">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <section className="bg-sumi-light rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gold uppercase tracking-wider">Basic Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>Name (JP)</span>
                {editing ? (
                  <input className={inputCls} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.name || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Name (EN)</span>
                {editing ? (
                  <input className={inputCls} value={form.name_en || ""} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.name_en || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Area</span>
                {editing ? (
                  <input className={inputCls} value={form.area || ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.area || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Genre</span>
                {editing ? (
                  <input className={inputCls} value={form.genre || ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.genre || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Price Range</span>
                {editing ? (
                  <input className={inputCls} value={form.price_range || ""} onChange={(e) => setForm({ ...form, price_range: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.price_range || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Rating</span>
                <p className="text-gold text-sm">
                  {store.rating ? `★ ${store.rating.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Tabelog URL</span>
                {editing ? (
                  <input className={inputCls} value={form.tabelog_url || ""} onChange={(e) => setForm({ ...form, tabelog_url: e.target.value })} />
                ) : store.tabelog_url ? (
                  <a href={store.tabelog_url} target="_blank" rel="noopener noreferrer" className="text-gold text-sm hover:underline break-all">
                    {store.tabelog_url}
                  </a>
                ) : (
                  <p className="text-shimofuri text-sm">—</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Address (JP)</span>
                {editing ? (
                  <input className={inputCls} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.address || "—"}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Address (EN)</span>
                {editing ? (
                  <input className={inputCls} value={form.address_en || ""} onChange={(e) => setForm({ ...form, address_en: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.address_en || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Phone</span>
                {editing ? (
                  <input className={inputCls} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.phone || "—"}</p>
                )}
              </div>
              <div>
                <span className={labelCls}>Hours</span>
                {editing ? (
                  <input className={inputCls} value={form.hours || ""} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                ) : (
                  <p className="text-shimofuri text-sm">{store.hours || "—"}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className={labelCls}>Google Maps</span>
                {editing ? (
                  <input className={inputCls} value={form.google_maps_url || ""} onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })} placeholder="https://maps.google.com/..." />
                ) : store.google_maps_url ? (
                  <a href={store.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-gold text-sm hover:underline break-all">
                    Open in Maps
                  </a>
                ) : (
                  <p className="text-shimofuri text-sm">—</p>
                )}
              </div>
            </div>
          </section>

          {/* Booking Difficulty */}
          <section className="bg-sumi-light rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
              Booking Difficulty
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={store.booking_difficulty || "Easy"}
                onChange={(e) => handleDifficultyChange(e.target.value)}
                className="bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red transition-colors"
              >
                {DIFFICULTIES.filter((d) => d !== "All").map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <DifficultyBadge difficulty={store.booking_difficulty} />
            </div>
          </section>

          {/* Taisei Notes */}
          <section className="bg-sumi-light rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
              Taisei&apos;s Notes
            </h3>
            {store.taisei_notes && (
              <pre className="text-shimofuri/70 text-sm whitespace-pre-wrap font-body bg-sumi rounded-lg p-4 max-h-48 overflow-y-auto">
                {store.taisei_notes}
              </pre>
            )}
            <div className="flex gap-2">
              <textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1 bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="self-end px-4 py-2 bg-charcoal-red text-shimofuri text-sm rounded-lg hover:bg-[#A63000] disabled:opacity-30 shrink-0"
              >
                Add
              </button>
            </div>
          </section>

          {/* Posts */}
          <section className="bg-sumi-light rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
              Posts ({posts.length})
            </h3>
            {loading ? (
              <p className="text-shimofuri/30 text-sm">Loading...</p>
            ) : posts.length === 0 ? (
              <p className="text-shimofuri/30 text-sm">No posts yet</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <div key={p.id} className="bg-sumi rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-shimofuri text-sm">
                        {p.memo ? p.memo.slice(0, 60) + (p.memo.length > 60 ? "..." : "") : "No memo"}
                      </p>
                      <p className="text-shimofuri/30 text-xs mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          p.status === "published"
                            ? "bg-[#2D6A4F] text-white"
                            : "bg-white/10 text-shimofuri/60"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.ghost_post_id && (
                        <span className="text-gold text-[10px]">Ghost</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bookings */}
          <section className="bg-sumi-light rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
              Bookings ({bookings.length})
            </h3>
            {loading ? (
              <p className="text-shimofuri/30 text-sm">Loading...</p>
            ) : bookings.length === 0 ? (
              <p className="text-shimofuri/30 text-sm">No bookings yet</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-sumi rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-shimofuri text-sm">{b.customer_name || "Guest"}</p>
                      <p className="text-shimofuri/30 text-xs mt-0.5">
                        {b.date ? new Date(b.date).toLocaleDateString("ja-JP") : "—"} · {b.party_size ?? "—"} pax
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        b.status === "confirmed"
                          ? "bg-[#2D6A4F] text-white"
                          : b.status === "cancelled"
                            ? "bg-red-900/50 text-red-300"
                            : "bg-white/10 text-shimofuri/60"
                      }`}
                    >
                      {b.status || "pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All");
  const [genreFilter, setGenreFilter] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [sortBy, setSortBy] = useState<SortKey>("rating");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setStores((data as Store[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Close detail on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedStore) setSelectedStore(null);
        else if (showAddModal) setShowAddModal(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedStore, showAddModal]);

  // Filter & sort
  const filtered = stores
    .filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchEn = s.name_en?.toLowerCase().includes(q);
        if (!matchName && !matchEn) return false;
      }
      if (areaFilter !== "All" && s.area !== areaFilter) return false;
      if (genreFilter !== "All" && s.genre !== genreFilter) return false;
      if (difficultyFilter !== "All" && s.booking_difficulty !== difficultyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "booking_count") return (b.booking_count || 0) - (a.booking_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  function handleStoreCreated(store: Store) {
    setStores((prev) => [store, ...prev]);
    showToast("Store added");
  }

  function handleStoreUpdated(updated: Store) {
    setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedStore(updated);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const selectCls =
    "bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-xs focus:outline-none focus:border-charcoal-red transition-colors";

  return (
    <div className="flex min-h-screen bg-sumi">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <MobileNav />

        {/* Header */}
        <header className="px-6 pt-8 pb-4 md:px-10 md:pt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-shimofuri tracking-wide">
              Store Database
            </h1>
            <p className="text-shimofuri/40 text-sm mt-1">
              {filtered.length} store{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors shrink-0"
          >
            + Add Store
          </button>
        </header>

        {/* Filters */}
        <div className="px-6 md:px-10 pb-4">
          <div className="bg-sumi-light rounded-xl p-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-sumi border border-white/10 rounded-lg px-3 py-2 text-shimofuri text-xs placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors w-44"
            />

            <select className={selectCls} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a === "All" ? "All Areas" : a}</option>
              ))}
            </select>

            <select className={selectCls} value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
              {GENRES.map((g) => (
                <option key={g} value={g}>{g === "All" ? "All Genres" : g}</option>
              ))}
            </select>

            <select className={selectCls} value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d === "All" ? "All Difficulty" : d}</option>
              ))}
            </select>

            <div className="flex-1" />

            <select className={selectCls} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="rating">Sort: Rating</option>
              <option value="booking_count">Sort: Bookings</option>
              <option value="created_at">Sort: Recent</option>
            </select>

            {/* View Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button
                onClick={() => setViewMode("card")}
                className={`px-3 py-2 text-xs transition-colors ${
                  viewMode === "card" ? "bg-charcoal-red text-shimofuri" : "bg-sumi text-shimofuri/40 hover:text-shimofuri"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 text-xs transition-colors ${
                  viewMode === "table" ? "bg-charcoal-red text-shimofuri" : "bg-sumi text-shimofuri/40 hover:text-shimofuri"
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 pb-12 md:px-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-shimofuri/30 text-sm">
                {stores.length === 0 ? "No stores yet. Add your first store." : "No stores match your filters."}
              </p>
            </div>
          ) : viewMode === "card" ? (
            /* Card View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStore(s)}
                  className="text-left bg-sumi-light rounded-xl p-5 space-y-3 border border-transparent hover:border-charcoal-red transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-heading text-lg text-shimofuri truncate group-hover:text-gold transition-colors">
                        {s.name || "Unknown"}
                      </h3>
                      {s.name_en && (
                        <p className="text-shimofuri/30 text-xs truncate">{s.name_en}</p>
                      )}
                    </div>
                    {s.rating && (
                      <span className="text-gold text-sm font-medium shrink-0">
                        ★ {s.rating.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {s.area && (
                      <span className="text-[10px] bg-white/5 text-shimofuri/60 px-2 py-0.5 rounded">
                        {s.area}
                      </span>
                    )}
                    {s.genre && (
                      <span className="text-[10px] bg-white/5 text-shimofuri/60 px-2 py-0.5 rounded">
                        {s.genre}
                      </span>
                    )}
                    {s.price_range && (
                      <span className="text-[10px] bg-white/5 text-shimofuri/60 px-2 py-0.5 rounded">
                        {s.price_range}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <DifficultyBadge difficulty={s.booking_difficulty} />
                    <span className="text-shimofuri/30 text-xs">
                      {s.booking_count || 0} bookings
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="bg-sumi-light rounded-xl overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Store</th>
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Area</th>
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Genre</th>
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Price</th>
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Rating</th>
                      <th className="text-left px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Difficulty</th>
                      <th className="text-right px-4 py-3 text-shimofuri/40 text-xs font-medium uppercase tracking-wider">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStore(s)}
                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-shimofuri font-medium truncate max-w-[200px]">{s.name || "Unknown"}</p>
                          {s.name_en && <p className="text-shimofuri/30 text-xs truncate max-w-[200px]">{s.name_en}</p>}
                        </td>
                        <td className="px-4 py-3 text-shimofuri/60">{s.area || "—"}</td>
                        <td className="px-4 py-3 text-shimofuri/60">{s.genre || "—"}</td>
                        <td className="px-4 py-3 text-shimofuri/60 text-xs">{s.price_range || "—"}</td>
                        <td className="px-4 py-3 text-gold">{s.rating ? `★ ${s.rating.toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3"><DifficultyBadge difficulty={s.booking_difficulty} /></td>
                        <td className="px-4 py-3 text-right text-shimofuri/60">{s.booking_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Detail Panel */}
      {selectedStore && (
        <StoreDetail
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onUpdate={handleStoreUpdated}
        />
      )}

      {/* Add Modal */}
      <AddStoreModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleStoreCreated}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sumi-light border border-white/10 px-6 py-3 rounded-xl shadow-2xl z-50">
          <p className="text-shimofuri text-sm">{toast}</p>
        </div>
      )}
    </div>
  );
}
