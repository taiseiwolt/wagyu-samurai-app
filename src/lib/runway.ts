/**
 * Runway ML API client for video processing
 * - Image-to-video generation (Gen-4 Turbo)
 * - Video transformation (slow motion, color grading)
 */

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";

function getApiKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new Error("RUNWAY_API_KEY is not set");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    "X-Runway-Version": "2024-11-06",
  };
}

// ---------------------------------------------------------------------------
// Image-to-Video generation (Gen-4 Turbo)
// ---------------------------------------------------------------------------

interface ImageToVideoOptions {
  imageUrl: string;
  promptText?: string;
  duration?: 5 | 10;
  ratio?: "1280:720" | "720:1280";
}

export async function createImageToVideoTask(
  opts: ImageToVideoOptions
): Promise<string> {
  const body = {
    model: "gen4_turbo",
    promptImage: [{ uri: opts.imageUrl, position: "first" }],
    promptText:
      opts.promptText ??
      "Slow cinematic pan over premium wagyu beef with gentle steam rising",
    duration: opts.duration ?? 5,
    ratio: opts.ratio ?? "720:1280",
  };

  const res = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Runway image-to-video failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id as string; // task ID
}

// ---------------------------------------------------------------------------
// Poll task until completion
// ---------------------------------------------------------------------------

interface RunwayTaskResult {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  output?: string[]; // URLs of generated videos
  failure?: string;
  progress?: number;
}

export async function pollTaskUntilDone(
  taskId: string,
  intervalMs = 3000,
  maxAttempts = 120
): Promise<RunwayTaskResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      method: "GET",
      headers: headers(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Runway poll failed (${res.status}): ${err}`);
    }

    const task: RunwayTaskResult = await res.json();

    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(
        `Runway task ${task.status}: ${task.failure ?? "unknown error"}`
      );
    }

    // Still running — wait and retry
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Runway task timed out after ${maxAttempts} polls`);
}

// ---------------------------------------------------------------------------
// Download generated video as Buffer
// ---------------------------------------------------------------------------

export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
