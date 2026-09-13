import { decodeImage, drawOverlay, type ReadResult } from "./barcode-reader";

export type VideoSource = { kind: "file"; objectUrl: string } | { kind: "camera"; stream: MediaStream };

export interface VideoSession {
  video: HTMLVideoElement;
  source: VideoSource;
  usesFrameCallback: boolean;
  /** Best-effort frames/sec, refined once real playback data is available; used only to translate a requested frame number into a seek time. */
  estimatedFps: number;
}

export function openVideoFile(video: HTMLVideoElement, file: File): Promise<VideoSession> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const usesFrameCallback = typeof video.requestVideoFrameCallback === "function";

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve({ video, source: { kind: "file", objectUrl }, usesFrameCallback, estimatedFps: 30 });
    };
    const onError = () => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load video file"));
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    video.src = objectUrl;
    video.load();
  });
}

/** Requests the device camera (rear-facing when available) and attaches it to `video`. Requires a secure context (HTTPS or localhost). */
export async function openCamera(video: HTMLVideoElement): Promise<VideoSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  const usesFrameCallback = typeof video.requestVideoFrameCallback === "function";

  video.srcObject = stream;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not start camera preview"));
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
  await video.play();

  return { video, source: { kind: "camera", stream }, usesFrameCallback, estimatedFps: 30 };
}

export function closeVideoSession(session: VideoSession) {
  session.video.pause();
  if (session.source.kind === "file") {
    session.video.removeAttribute("src");
    session.video.load();
    URL.revokeObjectURL(session.source.objectUrl);
  } else {
    session.video.srcObject = null;
    for (const track of session.source.stream.getTracks()) track.stop();
  }
}

export interface FrameInfo {
  frameIndex: number;
  timeSeconds: number;
}

export interface ScanResult {
  status: "found" | "ended" | "aborted";
  frame: FrameInfo;
  results: ReadResult[];
}

/**
 * Plays forward from the current position, decoding frames as they're
 * presented, until one has a barcode, playback reaches the end, or `signal`
 * is aborted. Uses requestVideoFrameCallback for true per-frame stepping
 * where supported (most Chromium browsers); elsewhere falls back to
 * time-based sampling during playback, since browsers otherwise expose no
 * way to step through actual encoded frames.
 */
export function scanForward(
  session: VideoSession,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  onFrame?: (frame: FrameInfo) => void,
): Promise<ScanResult> {
  const { video } = session;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;

  return new Promise((resolve) => {
    let settled = false;
    let frameIndex = 0;

    const onEnded = () => void settle("ended", false);
    const onAbort = () => void settle("aborted", false);

    const cleanup = () => {
      video.removeEventListener("ended", onEnded);
      signal.removeEventListener("abort", onAbort);
    };

    const settle = async (status: ScanResult["status"], decodeCurrent: boolean) => {
      if (settled) return;
      settled = true;
      video.pause();
      cleanup();
      let results: ReadResult[] = [];
      if (decodeCurrent) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        results = await decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (results.length) drawOverlay(ctx, canvas.width, results);
      }
      resolve({ status, frame: { frameIndex, timeSeconds: video.currentTime }, results });
    };

    video.addEventListener("ended", onEnded);
    signal.addEventListener("abort", onAbort);

    if (session.usesFrameCallback) {
      const onVideoFrame: VideoFrameRequestCallback = (_now, metadata) => {
        if (settled) return;
        frameIndex = metadata.presentedFrames;
        if (metadata.mediaTime > 0) session.estimatedFps = frameIndex / metadata.mediaTime;
        onFrame?.({ frameIndex, timeSeconds: metadata.mediaTime });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        void decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height)).then((results) => {
          if (settled) return;
          if (results.length > 0) {
            drawOverlay(ctx, canvas.width, results);
            settled = true;
            video.pause();
            cleanup();
            resolve({ status: "found", frame: { frameIndex, timeSeconds: metadata.mediaTime }, results });
          } else {
            video.requestVideoFrameCallback(onVideoFrame);
          }
        });
      };
      video.requestVideoFrameCallback(onVideoFrame);
      void video.play();
    } else {
      const SAMPLE_SECONDS = 1 / 10;
      let nextSampleAt = video.currentTime;
      const onTimeUpdate = () => {
        if (settled || video.currentTime < nextSampleAt) return;
        nextSampleAt = video.currentTime + SAMPLE_SECONDS;
        frameIndex += 1;
        onFrame?.({ frameIndex, timeSeconds: video.currentTime });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        void decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height)).then((results) => {
          if (settled) return;
          if (results.length > 0) {
            drawOverlay(ctx, canvas.width, results);
            settled = true;
            video.pause();
            video.removeEventListener("timeupdate", onTimeUpdate);
            cleanup();
            resolve({ status: "found", frame: { frameIndex, timeSeconds: video.currentTime }, results });
          }
        });
      };
      video.addEventListener("timeupdate", onTimeUpdate);
      void video.play();
    }
  });
}

export interface SeekResult {
  frame: FrameInfo;
  results: ReadResult[];
}

/**
 * Jumps directly to an approximate frame number — time = frameIndex /
 * estimatedFps, refined by any prior scanForward() call — and decodes just
 * that one frame. Exact frame-accurate seeking isn't available in browsers
 * without demuxing the video (WebCodecs), so this is a best-effort jump.
 */
export function seekToFrame(
  session: VideoSession,
  canvas: HTMLCanvasElement,
  frameIndex: number,
): Promise<SeekResult> {
  const { video } = session;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  const maxTime = Number.isFinite(video.duration) ? video.duration : Infinity;
  const targetTime = Math.min(Math.max(frameIndex / session.estimatedFps, 0), maxTime);

  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      void decodeImage(ctx.getImageData(0, 0, canvas.width, canvas.height)).then((results) => {
        if (results.length) drawOverlay(ctx, canvas.width, results);
        resolve({ frame: { frameIndex, timeSeconds: video.currentTime }, results });
      });
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = targetTime;
  });
}
