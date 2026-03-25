"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

// --- Types ---

interface StoreData {
  id: string;
  name: string | null;
  genre: string | null;
  area: string | null;
  price_range: string | null;
  rating: number | null;
  tabelog_url: string;
}

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  storagePath?: string;
  mediaId?: string;
  uploading: boolean;
  error?: string;
}

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
          const active = href === "/upload";
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
        const active = href === "/upload";
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

// --- File Drop Zone ---

function DropZone({
  label,
  accept,
  maxFiles,
  files,
  onAdd,
  onRemove,
  renderPreview,
}: {
  label: string;
  accept: string;
  maxFiles: number;
  files: UploadedFile[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  renderPreview: (f: UploadedFile) => React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) onAdd(e.dataTransfer.files);
    },
    [onAdd],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
        {label}
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-charcoal-red bg-charcoal-red/10"
            : "border-white/20 hover:border-charcoal-red/60"
        } ${files.length >= maxFiles ? "opacity-50 pointer-events-none" : ""}`}
      >
        <p className="text-shimofuri/50 text-sm">
          Drag & drop or click to select ({files.length}/{maxFiles})
        </p>
        <p className="text-shimofuri/30 text-xs mt-1">
          {accept.replace(/\./g, "").toUpperCase()}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="relative group rounded-lg overflow-hidden bg-sumi-light"
            >
              {renderPreview(f)}
              {f.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {f.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 p-2">
                  <p className="text-xs text-white text-center">{f.error}</p>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(f.id);
                }}
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-charcoal-red"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Upload Page ---

export default function UploadPage() {
  // Tabelog scrape state
  const [tabelogUrl, setTabelogUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [storeExists, setStoreExists] = useState(false);

  // File upload state
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [videos, setVideos] = useState<UploadedFile[]>([]);

  // Memo state
  const [memo, setMemo] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [processingImages, setProcessingImages] = useState(false);

  // --- Scrape handler ---
  async function handleScrape() {
    if (!tabelogUrl.trim()) return;
    setScraping(true);
    setScrapeError(null);
    setStore(null);
    setStoreExists(false);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tabelogUrl.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setScrapeError(data.error || "Failed to fetch store data");
        return;
      }
      setStore(data.store);
      // Check if store already had posts (already registered)
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.store.id);
      if (count && count > 0) setStoreExists(true);
    } catch {
      setScrapeError("Network error. Please try again.");
    } finally {
      setScraping(false);
    }
  }

  // --- File upload helpers ---
  function createUploadedFile(file: File): UploadedFile {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: false,
    };
  }

  async function uploadToStorage(
    f: UploadedFile,
    bucket: "photos" | "videos",
    type: "photo" | "video",
  ): Promise<UploadedFile> {
    if (!store) return { ...f, error: "No store selected" };

    const ext = f.file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${store.id}/${f.id}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(path, f.file, { upsert: true });

    if (storageError) {
      return { ...f, uploading: false, error: storageError.message };
    }

    const { data: mediaData, error: dbError } = await supabase
      .from("media")
      .insert({
        post_id: null,
        store_id: store.id,
        type,
        storage_path: `${bucket}/${path}`,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (dbError) {
      return { ...f, uploading: false, error: dbError.message };
    }

    return {
      ...f,
      uploading: false,
      storagePath: path,
      mediaId: mediaData.id,
    };
  }

  function handleAddPhotos(fileList: FileList) {
    const remaining = 10 - photos.length;
    if (remaining <= 0) return;
    const accepted = Array.from(fileList)
      .filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f.name))
      .slice(0, remaining);
    const newFiles = accepted.map(createUploadedFile);
    setPhotos((prev) => [...prev, ...newFiles]);

    // Upload each in background
    newFiles.forEach(async (nf) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === nf.id ? { ...p, uploading: true } : p)),
      );
      const result = await uploadToStorage(nf, "photos", "photo");
      setPhotos((prev) => prev.map((p) => (p.id === nf.id ? result : p)));
    });
  }

  function handleRemovePhoto(id: string) {
    const file = photos.find((p) => p.id === id);
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function handleAddVideos(fileList: FileList) {
    const remaining = 5 - videos.length;
    if (remaining <= 0) return;
    const accepted = Array.from(fileList)
      .filter((f) => /\.(mp4|mov)$/i.test(f.name))
      .slice(0, remaining);
    const newFiles = accepted.map(createUploadedFile);
    setVideos((prev) => [...prev, ...newFiles]);

    newFiles.forEach(async (nf) => {
      setVideos((prev) =>
        prev.map((v) => (v.id === nf.id ? { ...v, uploading: true } : v)),
      );
      const result = await uploadToStorage(nf, "videos", "video");
      setVideos((prev) => prev.map((v) => (v.id === nf.id ? result : v)));
    });
  }

  function handleRemoveVideo(id: string) {
    const file = videos.find((v) => v.id === id);
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  // --- Generate handler ---
  const canSubmit = store && photos.length > 0 && !submitting;

  async function handleGenerate() {
    if (!canSubmit || !store) return;
    setSubmitting(true);
    setProcessingImages(true);

    try {
      const mediaIds = [
        ...photos.filter((p) => p.mediaId).map((p) => p.mediaId),
        ...videos.filter((v) => v.mediaId).map((v) => v.mediaId),
      ];

      // 1. Create post draft
      const { data: postData, error } = await supabase
        .from("posts")
        .insert({
          store_id: store.id,
          status: "draft",
          memo: memo.trim() || null,
          media_ids: mediaIds,
        })
        .select("id")
        .single();

      if (error || !postData) {
        setToast(`Error: ${error?.message || "Failed to create post"}`);
        return;
      }

      const postId = postData.id;

      // 2. Update media records with post_id
      const photoMediaIds = photos
        .filter((p) => p.mediaId)
        .map((p) => p.mediaId);
      if (photoMediaIds.length > 0) {
        await supabase
          .from("media")
          .update({ post_id: postId })
          .in("id", photoMediaIds);
      }

      setToast("Draft created! Generating content & processing images...");

      // 3. Kick off text generation + image processing in parallel
      const [generateRes, imageRes] = await Promise.allSettled([
        fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId, store_id: store.id }),
        }),
        fetch("/api/process/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        }),
      ]);

      const msgs: string[] = [];
      if (generateRes.status === "fulfilled" && generateRes.value.ok) {
        msgs.push("Text generated");
      } else {
        msgs.push("Text generation failed");
      }
      if (imageRes.status === "fulfilled" && imageRes.value.ok) {
        msgs.push("Images processed");
      } else {
        msgs.push("Image processing failed");
      }

      setToast(msgs.join(" · "));
    } catch {
      setToast("Failed to create draft. Please try again.");
    } finally {
      setSubmitting(false);
      setProcessingImages(false);
      setTimeout(() => setToast(null), 5000);
    }
  }

  // --- Render ---
  return (
    <div className="flex min-h-screen bg-sumi">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <MobileNav />

        {/* Header */}
        <header className="px-6 pt-8 pb-4 md:px-10 md:pt-10">
          <h1 className="font-heading text-3xl md:text-4xl font-light text-shimofuri tracking-wide">
            Upload
          </h1>
          <p className="text-shimofuri/40 text-sm mt-1">
            Add store info, photos, and videos for content generation
          </p>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pb-12 md:px-10 max-w-[800px]">
          <div className="space-y-8">
            {/* 1. Tabelog URL */}
            <section className="bg-sumi-light rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-medium text-gold uppercase tracking-wider">
                Tabelog URL
              </h2>
              <div className="flex gap-3">
                <input
                  type="url"
                  placeholder="Paste tabelog URL here..."
                  value={tabelogUrl}
                  onChange={(e) => setTabelogUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScrape();
                  }}
                  className="flex-1 bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors"
                />
                <button
                  onClick={handleScrape}
                  disabled={!tabelogUrl.trim() || scraping}
                  className="px-6 py-3 bg-charcoal-red text-shimofuri text-sm font-medium rounded-lg hover:bg-[#A63000] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {scraping ? "Fetching..." : "Fetch"}
                </button>
              </div>

              {scrapeError && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-300 text-sm">{scrapeError}</p>
                </div>
              )}

              {store && (
                <div className="bg-sumi rounded-lg p-5 space-y-3 border border-white/5">
                  {storeExists && (
                    <div className="bg-gold/10 border border-gold/30 rounded px-3 py-2 mb-2">
                      <p className="text-gold text-xs">
                        This store is already registered
                      </p>
                    </div>
                  )}
                  <h3 className="font-heading text-xl text-shimofuri">
                    {store.name || "Unknown Store"}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-xs text-shimofuri/60">
                    {store.genre && (
                      <span className="bg-white/5 px-2.5 py-1 rounded">
                        {store.genre}
                      </span>
                    )}
                    {store.area && (
                      <span className="bg-white/5 px-2.5 py-1 rounded">
                        {store.area}
                      </span>
                    )}
                    {store.price_range && (
                      <span className="bg-white/5 px-2.5 py-1 rounded">
                        {store.price_range}
                      </span>
                    )}
                    {store.rating && (
                      <span className="bg-gold/10 text-gold px-2.5 py-1 rounded">
                        ★ {store.rating.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2. Photo Upload */}
            <section className="bg-sumi-light rounded-xl p-6">
              <DropZone
                label="Photos (required)"
                accept=".jpg,.jpeg,.png,.heic,.webp"
                maxFiles={10}
                files={photos}
                onAdd={handleAddPhotos}
                onRemove={handleRemovePhoto}
                renderPreview={(f) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={f.previewUrl}
                    alt="preview"
                    className="w-full aspect-square object-cover"
                  />
                )}
              />
            </section>

            {/* 3. Video Upload */}
            <section className="bg-sumi-light rounded-xl p-6">
              <DropZone
                label="Videos (optional)"
                accept=".mp4,.mov"
                maxFiles={5}
                files={videos}
                onAdd={handleAddVideos}
                onRemove={handleRemoveVideo}
                renderPreview={(f) => (
                  <div className="w-full aspect-video bg-sumi flex items-center justify-center relative">
                    <video
                      src={f.previewUrl}
                      className="w-full h-full object-cover"
                      muted
                    />
                    <span className="absolute bottom-1 left-1 text-shimofuri/40 text-[10px] truncate max-w-[90%]">
                      {f.file.name}
                    </span>
                  </div>
                )}
              />
            </section>

            {/* 4. Memo */}
            <section className="bg-sumi-light rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-gold uppercase tracking-wider">
                Memo / Notes
              </h3>
              <textarea
                placeholder="箇条書きや単語でOK（例：霜降りヤバい、店主こだわり強い、雰囲気◎）"
                value={memo}
                onChange={(e) => {
                  setMemo(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }}
                rows={3}
                className="w-full bg-sumi border border-white/10 rounded-lg px-4 py-3 text-shimofuri text-sm placeholder:text-shimofuri/30 focus:outline-none focus:border-charcoal-red transition-colors resize-none"
              />
            </section>

            {/* 5. Generate Button */}
            <div className="pt-2 pb-8">
              <button
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="w-full py-4 bg-charcoal-red text-shimofuri font-heading text-lg tracking-wider rounded-xl hover:bg-[#A63000] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {submitting
                  ? processingImages
                    ? "Generating & Processing..."
                    : "Creating draft..."
                  : "Generate"}
              </button>
              {!store && (
                <p className="text-shimofuri/30 text-xs text-center mt-2">
                  Fetch a store from Tabelog first
                </p>
              )}
              {store && photos.length === 0 && (
                <p className="text-shimofuri/30 text-xs text-center mt-2">
                  Upload at least one photo
                </p>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sumi-light border border-white/10 px-6 py-3 rounded-xl shadow-2xl z-50">
          <p className="text-shimofuri text-sm">{toast}</p>
        </div>
      )}
    </div>
  );
}
