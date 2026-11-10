const FORMATS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

/**
 * @typedef {{status: "ready", blob: Blob, extension: "webm" | "mp4"} |
 *   {status: "cancelled"} | {status: "error", message: string}} RecordingResult
 */

/**
 * Record a canvas in real time. Only an explicit finish can produce a download.
 * @param {HTMLCanvasElement} canvas
 * @param {{audioTrack?: MediaStreamTrack, videoBitsPerSecond: number}} options
 */
export function startCanvasRecording(canvas, { audioTrack, videoBitsPerSecond }) {
  if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    throw new Error("This browser cannot record the video canvas.");
  }
  if (document.hidden) throw new Error("Keep this tab visible while exporting.");

  const stream = canvas.captureStream(30);
  const chunks = [];
  /** @type {MediaRecorder | undefined} */
  let recorder;
  let stopTimer;
  let finishRequested = false;
  let settled = false;
  /** @type {(result: RecordingResult) => void} */
  let resolveResult = () => {};
  /** @type {Promise<RecordingResult>} */
  const done = new Promise((resolve) => { resolveResult = resolve; });

  /** @param {RecordingResult} result */
  function settle(result) {
    if (settled) return;
    settled = true;
    clearTimeout(stopTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Ending the capture tracks below still releases the stream.
      }
    }
    for (const track of stream.getTracks()) track.stop();
    chunks.length = 0;
    resolveResult(result);
  }

  function onVisibility() {
    if (document.hidden) {
      settle({ status: "error", message: "The tab became hidden during export. Keep it visible and try again." });
    }
  }

  try {
    if (audioTrack?.readyState === "live") stream.addTrack(audioTrack.clone());
    if (!stream.getVideoTracks().length) throw new Error("Canvas capture did not provide a video track.");
    const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
    const mediaRecorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond });
    recorder = mediaRecorder;
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (!settled && event.data.size) chunks.push(event.data);
    });
    mediaRecorder.addEventListener("error", () => {
      settle({ status: "error", message: "The browser interrupted the recording." });
    });
    mediaRecorder.addEventListener("stop", () => {
      if (settled) return;
      const type = mediaRecorder.mimeType || chunks[0]?.type || mimeType || "";
      const container = /^video\/(webm|mp4)(?:;|$)/i.exec(type)?.[1]?.toLowerCase();
      if (!finishRequested || !chunks.length || (container !== "webm" && container !== "mp4")) {
        settle({ status: "error", message: "The browser returned an incomplete or unsupported recording." });
        return;
      }
      settle({ status: "ready", blob: new Blob(chunks, { type }), extension: container });
    });
    document.addEventListener("visibilitychange", onVisibility);
    mediaRecorder.start(250);
    return {
      done,
      finish() {
        if (settled || finishRequested) return;
        finishRequested = true;
        if (mediaRecorder.state === "inactive") {
          settle({ status: "error", message: "The recording stopped before the export could be finalized." });
          return;
        }
        stopTimer = setTimeout(() => settle({ status: "error", message: "The browser did not finish writing the video." }), 5000);
        try {
          mediaRecorder.stop();
        } catch {
          settle({ status: "error", message: "The browser could not finish writing the video." });
        }
      },
      cancel() {
        settle({ status: "cancelled" });
      },
    };
  } catch (error) {
    settle({ status: "error", message: "The browser could not start the video recorder." });
    throw error;
  }
}

/** @param {Blob} blob @param {string} filename */
export function downloadRecording(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
