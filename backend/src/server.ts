import { Hono } from "hono";
import path from "path";
import { db, type Pod, type Episode } from "./db.js";
import { runSeed } from "./seed.js";
import { ensureMediaDirs, saveImage, mediaUrl, nextSequenceNumber } from "./media.js";
import { runPipeline } from "./pipeline.js";

// Boot: create tables, seed demo data, ensure media dirs
runSeed();
ensureMediaDirs();

const app = new Hono();

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
app.get("/api/health", (c) => {
  return c.json({ ok: true, ts: Date.now() });
});

// ---------------------------------------------------------------------------
// GET /api/pods/:id
// ---------------------------------------------------------------------------
app.get("/api/pods/:id", (c) => {
  const podId = c.req.param("id");

  const pod = db.query<Pod, [string]>("SELECT * FROM pods WHERE id = ?").get(podId);
  if (!pod) return c.json({ error: "Pod not found" }, 404);

  const recentSnaps = db
    .query<{ id: string; image_path: string; sequence_number: number }, [string]>(
      "SELECT id, image_path, sequence_number FROM meal_images WHERE pod_id = ? ORDER BY sequence_number DESC LIMIT 10"
    )
    .all(podId)
    .map((row) => ({
      id: row.id,
      thumb: mediaUrl(row.image_path),
    }));

  const episode = db
    .query<Episode, [string]>("SELECT * FROM episodes WHERE pod_id = ?")
    .get(podId);

  return c.json({
    id: pod.id,
    status: pod.status,
    targetCount: pod.target_count,
    capturedCount: pod.captured_count,
    recentSnaps,
    episode: episode
      ? {
          audioUrl: episode.audio_path ? mediaUrl(episode.audio_path) : null,
          title: episode.title,
          date: new Date(episode.created_at).toISOString(),
          summaryText: episode.summary_text,
          durationSec: episode.duration_sec,
        }
      : undefined,
  });
});

// ---------------------------------------------------------------------------
// POST /api/pods/:id/images
// Multipart form, field: image
// ---------------------------------------------------------------------------
app.post("/api/pods/:id/images", async (c) => {
  const podId = c.req.param("id");

  const pod = db.query<Pod, [string]>("SELECT * FROM pods WHERE id = ?").get(podId);
  if (!pod) return c.json({ error: "Pod not found" }, 404);
  if (pod.status !== "collecting") {
    return c.json({ error: `Pod is not collecting (status=${pod.status})` }, 409);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Failed to parse multipart form data" }, 400);
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing 'image' field in multipart form" }, 400);
  }

  // Determine extension from MIME or filename
  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  const ext =
    mimeExt[file.type] ??
    path.extname(file.name).replace(".", "") ??
    "bin";

  const buffer = await file.arrayBuffer();
  const imagePath = await saveImage(podId, buffer, ext);

  const imageId = crypto.randomUUID();
  const now = Date.now();

  // Atomically insert image row and increment captured_count
  const doInsert = db.transaction(() => {
    const seqNum = nextSequenceNumber(podId);

    db.run(
      "INSERT INTO meal_images (id, pod_id, sequence_number, image_path, uploaded_at) VALUES (?, ?, ?, ?, ?)",
      [imageId, podId, seqNum, imagePath, now]
    );

    db.run("UPDATE pods SET captured_count = captured_count + 1 WHERE id = ?", [podId]);

    const updated = db
      .query<{ captured_count: number }, [string]>(
        "SELECT captured_count FROM pods WHERE id = ?"
      )
      .get(podId);

    return { seqNum, capturedCount: updated?.captured_count ?? 0 };
  });

  const { seqNum, capturedCount } = doInsert();

  return c.json({
    imageId,
    sequenceNumber: seqNum,
    capturedCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/pods/:id/complete
// ---------------------------------------------------------------------------
app.post("/api/pods/:id/complete", async (c) => {
  const podId = c.req.param("id");

  const pod = db.query<Pod, [string]>("SELECT * FROM pods WHERE id = ?").get(podId);
  if (!pod) return c.json({ error: "Pod not found" }, 404);

  if (pod.status !== "collecting") {
    return c.json({ status: pod.status });
  }

  if (pod.captured_count < pod.target_count) {
    return c.json(
      {
        status: pod.status,
        error: `Not enough images: ${pod.captured_count}/${pod.target_count}`,
      },
      422
    );
  }

  // Set status='generating' — E2 will run here
  db.run("UPDATE pods SET status = 'generating' WHERE id = ?", [podId]);

  // Fire pipeline in background (do NOT await — returns immediately)
  void runPipeline(podId);

  return c.json({ status: "generating" });
});

// ---------------------------------------------------------------------------
// GET /api/pods/:id/episode
// ---------------------------------------------------------------------------
app.get("/api/pods/:id/episode", (c) => {
  const podId = c.req.param("id");

  const pod = db.query<Pod, [string]>("SELECT * FROM pods WHERE id = ?").get(podId);
  if (!pod) return c.json({ error: "Pod not found" }, 404);

  const episode = db
    .query<Episode, [string]>("SELECT * FROM episodes WHERE pod_id = ?")
    .get(podId);

  if (!episode) {
    return c.json({ error: "Episode not ready" }, 404);
  }

  return c.json({
    audioUrl: episode.audio_path ? mediaUrl(episode.audio_path) : null,
    title: episode.title,
    date: new Date(episode.created_at).toISOString(),
    summaryText: episode.summary_text,
    durationSec: episode.duration_sec,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

console.log(`[server] Food Pod backend starting on http://${HOST}:${PORT}`);

export default {
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
};
