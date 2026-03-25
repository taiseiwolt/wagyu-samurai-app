"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

// --- Types ---

interface PostRow {
  id: string;
  store_id: string;
  status: string;
  memo: string | null;
  ig_caption: string | null;
  ig_hashtags: string | null;
  ghost_title: string | null;
  ghost_body: string | null;
  ghost_meta_desc: string | null;
  medium_body: string | null;
  ghost_post_id: string | null;
  medium_post_id: string | null;
  published_at: string | null;
  created_at: string;
  stores?: { name: string | null; area: string | null } | null;
}

interface MediaRow {
  id: string;
  type: string;
  storage_path: string;
  processing_status: string;
  processed_url: string | null;
}

// --- Navigation (shared pattern) ---

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
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
              href === "/review"
                ? "bg-charcoal-red text-shimofuri"
                : "text-shimofuri/60 hover:text-shimofuri hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="md:hidden flex items-center gap-1 overflow-x-auto bg-sumi px-4 py-3 border-b border-white/10">
      <Link href="/" className="font-heading text-lg text-shimofuri tracking-wider mr-4 shrink-0">
        WS
      </Link>
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
            href === "/review"
              ? "bg-charcoal-red text-shimofuri"
              : "text-shimofuri/60 hover:text-shimofuri"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

// --- Tab types ---

type TabKey = "instagram" | "ghost" | "medium";

const TABS: { key: TabKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "ghost", label: "Ghost" },
  { key: "medium", label: "Medium" },
];

// --- Main Component ---

export default function ReviewPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("instagram");
  const [toast, setToast] = useState<string | null>(null);

  // Editable fields
  const [igCaption, setIgCaption] = useState("");
  const [igHashtags, setIgHashtags] = useState("");
  const [ghostTitle, setGhostTitle] = useState("");
  const [ghostBody, setGhostBody] = useState("");
  const [ghostMetaDesc, setGhostMetaDesc] = useState("");
  const [mediumBody, setMediumBody] = useState("");

  // Publishing state
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<{
    ghost?: boolean;
    medium?: boolean;
    ig?: boolean;
  }>({});

  // --- Fetch posts ---
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*, stores(name, area)")
      .in("status", ["draft", "published"])
      .order("created_at", { ascending: false });

    if (!error && data) setPosts(data as PostRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // --- Select post ---
  async function selectPost(post: PostRow) {
    setSelectedPost(post);
    setIgCaption(post.ig_caption || "");
    setIgHashtags(post.ig_hashtags || "");
    setGhostTitle(post.ghost_title || "");
    setGhostBody(post.ghost_body || "");
    setGhostMetaDesc(post.ghost_meta_desc || "");
    setMediumBody(post.medium_body || "");
    setPublishStatus({
      ghost: !!post.ghost_post_id,
      medium: !!post.medium_post_id,
    });
    setActiveTab("instagram");

    // Fetch media
    const { data } = await supabase
      .from("media")
      .select("id, type, storage_path, processing_status, processed_url")
      .eq("post_id", post.id)
      .order("type");

    setMedia((data as MediaRow[]) || []);
  }

  // --- Save edits ---
  async function saveEdits() {
    if (!selectedPost) return;
    const { error } = await supabase
      .from("posts")
      .update({
        ig_caption: igCaption,
        ig_hashtags: igHashtags,
        ghost_title: ghostTitle,
        ghost_body: ghostBody,
        ghost_meta_desc: ghostMetaDesc,
        medium_body: mediumBody,
      })
      .eq("id", selectedPost.id);

    if (error) {
      showToast("Save failed: " + error.message);
    } else {
      showToast("Saved");
      // Update local state
      setSelectedPost((p) =>
        p
          ? {
              ...p,
              ig_caption: igCaption,
              ig_hashtags: igHashtags,
              ghost_title: ghostTitle,
              ghost_body: ghostBody,
              ghost_meta_desc: ghostMetaDesc,
              medium_body: mediumBody,
            }
          : null
      );
    }
  }

  // --- Publish handlers ---
  async function publishToGhost() {
    if (!selectedPost) return;
    setPublishing("ghost");
    await saveEdits();

    try {
      const res = await fetch("/api/publish/ghost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: selectedPost.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishStatus((s) => ({ ...s, ghost: true }));
        showToast("Published to Ghost");
      } else {
        showToast(data.error || "Ghost publish failed");
      }
    } catch {
      showToast("Ghost publish failed");
    } finally {
      setPublishing(null);
    }
  }

  async function publishToMedium() {
    if (!selectedPost) return;
    setPublishing("medium");
    await saveEdits();

    try {
      const res = await fetch("/api/publish/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: selectedPost.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishStatus((s) => ({ ...s, medium: true }));
        showToast("Published to Medium");
      } else {
        showToast(data.error || "Medium publish failed");
      }
    } catch {
      showToast("Medium publish failed");
    } finally {
      setPublishing(null);
    }
  }

  async function copyForInstagram() {
    const text = igCaption + "\n\n" + igHashtags;
    await navigator.clipboard.writeText(text);
    setPublishStatus((s) => ({ ...s, ig: true }));
    showToast("Caption copied! Now paste in Instagram.");
  }

  // --- Mark as published ---
  async function markPublished() {
    if (!selectedPost) return;
    await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", selectedPost.id);
    showToast("Marked as published");
    setSelectedPost((p) => (p ? { ...p, status: "published" } : null));
    fetchPosts();
  }

  // --- Regenerate ---
  async function regenerateText() {
    if (!selectedPost) return;
    setPublishing("regen-text");
    showToast("Regenerating text...");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: selectedPost.id,
          store_id: selectedPost.store_id,
        }),
      });
      if (res.ok) {
        // Re-fetch post
        const { data } = await supabase
          .from("posts")
          .select("*, stores(name, area)")
          .eq("id", selectedPost.id)
          .single();
        if (data) selectPost(data as PostRow);
        showToast("Text regenerated");
      } else {
        showToast("Regeneration failed");
      }
    } catch {
      showToast("Regeneration failed");
    } finally {
      setPublishing(null);
    }
  }

  async function reprocessImages() {
    if (!selectedPost) return;
    setPublishing("regen-img");
    showToast("Reprocessing images...");
    try {
      const res = await fetch("/api/process/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: selectedPost.id }),
      });
      if (res.ok) {
        showToast("Images reprocessed");
        // Re-fetch media
        const { data } = await supabase
          .from("media")
          .select("id, type, storage_path, processing_status, processed_url")
          .eq("post_id", selectedPost.id);
        setMedia((data as MediaRow[]) || []);
      } else {
        showToast("Image reprocessing failed");
      }
    } catch {
      showToast("Image reprocessing failed");
    } finally {
      setPublishing(null);
    }
  }

  async function reprocessVideos() {
    if (!selectedPost) return;
    setPublishing("regen-vid");
    showToast("Reprocessing videos...");
    try {
      const res = await fetch("/api/process/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: selectedPost.id,
          options: { slow_motion: true, add_bgm: true, bgm_track: "lofi_01" },
        }),
      });
      if (res.ok) {
        showToast("Video reprocessing started");
      } else {
        showToast("Video reprocessing failed");
      }
    } catch {
      showToast("Video reprocessing failed");
    } finally {
      setPublishing(null);
    }
  }

  // --- Download helpers ---
  function getProcessedUrls(m: MediaRow): { square?: string; portrait?: string } {
    if (!m.processed_url) return {};
    try {
      return JSON.parse(m.processed_url);
    } catch {
      return { square: m.processed_url };
    }
  }

  async function downloadMedia(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const photos = media.filter((m) => m.type === "photo");
  const videoMedia = media.filter((m) => m.type === "video");
  const processedPhotos = photos.filter((m) => m.processing_status === "done");

  // --- Render ---
  return (
    <div className="flex min-h-screen bg-sumi">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <MobileNav />

        <header className="px-6 pt-8 pb-4 md:px-10 md:pt-10">
          <h1 className="font-heading text-3xl md:text-4xl font-light text-shimofuri tracking-wide">
            Review & Publish
          </h1>
          <p className="text-shimofuri/40 text-sm mt-1">
            Edit generated content and distribute to channels
          </p>
        </header>

        <main className="flex-1 px-6 pb-24 md:px-10">
          {!selectedPost ? (
            /* ─── POST LIST ─── */
            <div className="space-y-3">
              {loading ? (
                <p className="text-shimofuri/40 text-sm">Loading posts...</p>
              ) : posts.length === 0 ? (
                <div className="bg-sumi-light rounded-xl p-8 text-center">
                  <p className="text-shimofuri/50 text-sm">
                    No posts yet.{" "}
                    <Link href="/upload" className="text-gold hover:underline">
                      Upload content
                    </Link>{" "}
                    to get started.
                  </p>
                </div>
              ) : (
                posts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPost(p)}
                    className="w-full bg-sumi-light rounded-xl p-5 text-left hover:ring-1 hover:ring-charcoal-red/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-heading text-lg text-shimofuri">
                          {p.stores?.name || "Unknown Store"}
                        </h3>
                        <p className="text-shimofuri/40 text-xs mt-1">
                          {p.stores?.area ? `${p.stores.area} · ` : ""}
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded text-xs ${
                            p.status === "published"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-gold/10 text-gold"
                          }`}
                        >
                          {p.status}
                        </span>
                        {p.ghost_post_id && (
                          <span className="text-[10px] text-shimofuri/30 bg-white/5 px-1.5 py-0.5 rounded">
                            Ghost
                          </span>
                        )}
                        {p.medium_post_id && (
                          <span className="text-[10px] text-shimofuri/30 bg-white/5 px-1.5 py-0.5 rounded">
                            Medium
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* ─── DETAIL EDITOR ─── */
            <div className="space-y-6">
              {/* Back + meta */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedPost(null);
                    setPublishStatus({});
                  }}
                  className="text-shimofuri/50 text-sm hover:text-shimofuri transition-colors"
                >
                  ← Back to list
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded text-xs ${
                      selectedPost.status === "published"
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gold/10 text-gold"
                    }`}
                  >
                    {selectedPost.status}
                  </span>
                  <h2 className="font-heading text-xl text-shimofuri">
                    {selectedPost.stores?.name || "Unknown"}
                  </h2>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-sumi-light rounded-lg p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex-1 py-2.5 rounded text-sm font-medium transition-colors ${
                      activeTab === t.key
                        ? "bg-charcoal-red text-shimofuri"
                        : "text-shimofuri/50 hover:text-shimofuri"
                    }`}
                  >
                    {t.label}
                    {t.key === "ghost" && publishStatus.ghost && " ✓"}
                    {t.key === "medium" && publishStatus.medium && " ✓"}
                    {t.key === "instagram" && publishStatus.ig && " ✓"}
                  </button>
                ))}
              </div>

              {/* ─── INSTAGRAM TAB ─── */}
              {activeTab === "instagram" && (
                <div className="space-y-6">
                  {/* IG Preview Mock */}
                  <div className="bg-sumi-light rounded-xl overflow-hidden max-w-sm mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-charcoal-red flex items-center justify-center text-shimofuri text-[10px] font-bold">
                        WS
                      </div>
                      <span className="text-shimofuri text-sm font-medium">
                        wagyu_samurai
                      </span>
                    </div>
                    {/* Image */}
                    {processedPhotos.length > 0 ? (
                      <div className="aspect-square bg-sumi">
                        {(() => {
                          const urls = getProcessedUrls(processedPhotos[0]);
                          const src = urls.square || urls.portrait;
                          return src ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={src}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-shimofuri/30 text-xs">
                              No processed image
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="aspect-square bg-sumi flex items-center justify-center text-shimofuri/30 text-sm">
                        Processing...
                      </div>
                    )}
                    {/* Caption preview */}
                    <div className="px-4 py-3">
                      <p className="text-shimofuri text-xs leading-relaxed line-clamp-4">
                        <span className="font-bold">wagyu_samurai</span>{" "}
                        {igCaption.slice(0, 200)}
                        {igCaption.length > 200 && "..."}
                      </p>
                    </div>
                  </div>

                  {/* Caption editor */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-gold text-xs uppercase tracking-wider font-medium">
                        Caption
                      </label>
                      <span className="text-shimofuri/30 text-xs">
                        {igCaption.length} chars
                      </span>
                    </div>
                    <textarea
                      value={igCaption}
                      onChange={(e) => setIgCaption(e.target.value)}
                      rows={6}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red resize-none"
                    />
                  </div>

                  {/* Hashtags editor */}
                  <div className="space-y-2">
                    <label className="text-gold text-xs uppercase tracking-wider font-medium">
                      Hashtags
                    </label>
                    <textarea
                      value={igHashtags}
                      onChange={(e) => setIgHashtags(e.target.value)}
                      rows={3}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red resize-none"
                    />
                  </div>

                  {/* Image gallery */}
                  {processedPhotos.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-gold text-xs uppercase tracking-wider font-medium">
                        Processed Images
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {processedPhotos.map((m) => {
                          const urls = getProcessedUrls(m);
                          return (
                            <div key={m.id} className="space-y-1">
                              {urls.square && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={urls.square}
                                  alt="1:1"
                                  className="w-full aspect-square object-cover rounded"
                                />
                              )}
                              <button
                                onClick={() =>
                                  downloadMedia(
                                    urls.square || urls.portrait || "",
                                    `ws_ig_${m.id}.jpg`
                                  )
                                }
                                className="w-full text-[10px] text-shimofuri/40 hover:text-gold transition-colors"
                              >
                                Download
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Video preview */}
                  {videoMedia.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-gold text-xs uppercase tracking-wider font-medium">
                        Videos
                      </label>
                      {videoMedia.map((v) => {
                        const url = v.processed_url || "";
                        return (
                          <div key={v.id} className="space-y-1">
                            {url && (
                              <video
                                src={url}
                                controls
                                className="w-full max-w-sm rounded"
                              />
                            )}
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  v.processing_status === "done"
                                    ? "bg-green-900/30 text-green-400"
                                    : "bg-gold/10 text-gold"
                                }`}
                              >
                                {v.processing_status}
                              </span>
                              {url && (
                                <button
                                  onClick={() =>
                                    downloadMedia(url, `ws_reel_${v.id}.mp4`)
                                  }
                                  className="text-[10px] text-shimofuri/40 hover:text-gold"
                                >
                                  Download video
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── GHOST TAB ─── */}
              {activeTab === "ghost" && (
                <div className="space-y-6">
                  {/* Ghost preview */}
                  <div className="bg-sumi-light rounded-xl p-6 space-y-4 max-w-2xl">
                    <h2 className="font-heading text-2xl text-shimofuri">
                      {ghostTitle || "Untitled"}
                    </h2>
                    <p className="text-shimofuri/50 text-sm italic">
                      {ghostMetaDesc || "No meta description"}
                    </p>
                    <div className="border-t border-white/5 pt-4">
                      <div
                        className="text-shimofuri/80 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: ghostBody || "<p>No content generated yet</p>",
                        }}
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <label className="text-gold text-xs uppercase tracking-wider font-medium">
                      Title
                    </label>
                    <input
                      value={ghostTitle}
                      onChange={(e) => setGhostTitle(e.target.value)}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red"
                    />
                  </div>

                  {/* Meta desc */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-gold text-xs uppercase tracking-wider font-medium">
                        Meta Description
                      </label>
                      <span
                        className={`text-xs ${
                          ghostMetaDesc.length > 155
                            ? "text-red-400"
                            : "text-shimofuri/30"
                        }`}
                      >
                        {ghostMetaDesc.length}/155
                      </span>
                    </div>
                    <textarea
                      value={ghostMetaDesc}
                      onChange={(e) => setGhostMetaDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red resize-none"
                    />
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <label className="text-gold text-xs uppercase tracking-wider font-medium">
                      Body (HTML)
                    </label>
                    <textarea
                      value={ghostBody}
                      onChange={(e) => setGhostBody(e.target.value)}
                      rows={12}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm font-mono focus:outline-none focus:border-charcoal-red resize-none"
                    />
                  </div>

                  {/* Hero image selection */}
                  {processedPhotos.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-gold text-xs uppercase tracking-wider font-medium">
                        Hero Image
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {processedPhotos.map((m) => {
                          const urls = getProcessedUrls(m);
                          return urls.portrait ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={m.id}
                              src={urls.portrait}
                              alt="hero"
                              className="w-full aspect-[4/5] object-cover rounded border-2 border-transparent hover:border-charcoal-red cursor-pointer"
                            />
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── MEDIUM TAB ─── */}
              {activeTab === "medium" && (
                <div className="space-y-6">
                  {/* Preview */}
                  <div className="bg-sumi-light rounded-xl p-6 space-y-3 max-w-2xl">
                    <h3 className="font-heading text-xl text-shimofuri">
                      {ghostTitle || "Untitled"}
                    </h3>
                    <div className="text-shimofuri/70 text-sm leading-relaxed whitespace-pre-wrap">
                      {mediumBody || "No Medium content generated yet"}
                    </div>
                    {selectedPost.ghost_post_id && (
                      <p className="text-gold text-xs pt-2 border-t border-white/5">
                        Ghost link will be auto-appended on publish
                      </p>
                    )}
                  </div>

                  {/* Editor */}
                  <div className="space-y-2">
                    <label className="text-gold text-xs uppercase tracking-wider font-medium">
                      Medium Body (Markdown)
                    </label>
                    <textarea
                      value={mediumBody}
                      onChange={(e) => setMediumBody(e.target.value)}
                      rows={10}
                      className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm focus:outline-none focus:border-charcoal-red resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ─── REGENERATE BUTTONS ─── */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={regenerateText}
                  disabled={!!publishing}
                  className="px-4 py-2 bg-white/5 text-shimofuri/60 text-xs rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  {publishing === "regen-text"
                    ? "Regenerating..."
                    : "Regenerate text"}
                </button>
                <button
                  onClick={reprocessImages}
                  disabled={!!publishing}
                  className="px-4 py-2 bg-white/5 text-shimofuri/60 text-xs rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  {publishing === "regen-img"
                    ? "Reprocessing..."
                    : "Reprocess images"}
                </button>
                <button
                  onClick={reprocessVideos}
                  disabled={!!publishing}
                  className="px-4 py-2 bg-white/5 text-shimofuri/60 text-xs rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  {publishing === "regen-vid"
                    ? "Reprocessing..."
                    : "Reprocess video"}
                </button>
                <button
                  onClick={saveEdits}
                  className="px-4 py-2 bg-white/5 text-gold text-xs rounded-lg hover:bg-white/10 transition-colors ml-auto"
                >
                  Save edits
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ─── PUBLISH BAR (fixed bottom) ─── */}
        {selectedPost && (
          <div className="fixed bottom-0 left-0 right-0 md:left-56 bg-sumi border-t border-white/10 px-6 py-4 flex items-center gap-3 z-40">
            {/* Publish status */}
            <div className="flex items-center gap-2 mr-auto text-xs">
              {publishStatus.ghost && (
                <span className="text-green-400">✓ Ghost</span>
              )}
              {publishStatus.medium && (
                <span className="text-green-400">✓ Medium</span>
              )}
              {publishStatus.ig && (
                <span className="text-green-400">✓ IG copied</span>
              )}
            </div>

            {/* Instagram */}
            <button
              onClick={copyForInstagram}
              disabled={!!publishing || !igCaption}
              className="px-4 py-2.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white text-xs font-medium rounded-lg disabled:opacity-30 transition-opacity"
            >
              Copy for IG
            </button>

            {/* Download images */}
            {processedPhotos.length > 0 && (
              <button
                onClick={() => {
                  processedPhotos.forEach((m) => {
                    const urls = getProcessedUrls(m);
                    if (urls.square)
                      downloadMedia(urls.square, `ws_${m.id}_sq.jpg`);
                    if (urls.portrait)
                      downloadMedia(urls.portrait, `ws_${m.id}_pt.jpg`);
                  });
                }}
                className="px-4 py-2.5 bg-gold/20 text-gold text-xs font-medium rounded-lg hover:bg-gold/30 transition-colors"
              >
                Download images
              </button>
            )}

            {/* Download video */}
            {videoMedia.some((v) => v.processed_url) && (
              <button
                onClick={() => {
                  videoMedia.forEach((v) => {
                    if (v.processed_url)
                      downloadMedia(v.processed_url, `ws_reel_${v.id}.mp4`);
                  });
                }}
                className="px-4 py-2.5 bg-gold/20 text-gold text-xs font-medium rounded-lg hover:bg-gold/30 transition-colors"
              >
                Download video
              </button>
            )}

            {/* Ghost */}
            <button
              onClick={publishToGhost}
              disabled={
                !!publishing || !ghostTitle || publishStatus.ghost === true
              }
              className="px-4 py-2.5 bg-charcoal-red text-shimofuri text-xs font-medium rounded-lg hover:bg-[#A63000] disabled:opacity-30 transition-colors"
            >
              {publishing === "ghost"
                ? "Publishing..."
                : publishStatus.ghost
                  ? "Ghost ✓"
                  : "Publish to Ghost"}
            </button>

            {/* Medium */}
            <button
              onClick={publishToMedium}
              disabled={
                !!publishing || !mediumBody || publishStatus.medium === true
              }
              className="px-4 py-2.5 bg-[#333] text-shimofuri text-xs font-medium rounded-lg hover:bg-[#444] disabled:opacity-30 transition-colors"
            >
              {publishing === "medium"
                ? "Publishing..."
                : publishStatus.medium
                  ? "Medium ✓"
                  : "Publish to Medium"}
            </button>

            {/* Mark published */}
            {selectedPost.status === "draft" &&
              (publishStatus.ghost || publishStatus.medium) && (
                <button
                  onClick={markPublished}
                  className="px-4 py-2.5 bg-green-800 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark Published
                </button>
              )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-sumi-light border border-white/10 px-6 py-3 rounded-xl shadow-2xl z-50">
            <p className="text-shimofuri text-sm">{toast}</p>
          </div>
        )}
      </div>
    </div>
  );
}
