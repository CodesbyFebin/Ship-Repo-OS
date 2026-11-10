import assert from "node:assert/strict";
import test from "node:test";
import { startCanvasRecording } from "../src/lib/shipos/canvas-recording.mjs";

class Recorder extends EventTarget {
  static format = "video/mp4";
  static isTypeSupported(format) { return format === this.format; }
  constructor(stream, options) {
    super();
    this.mimeType = options.mimeType;
    this.state = "inactive";
    Recorder.latest = this;
  }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    const event = new Event("dataavailable");
    event.data = new Blob(this.empty ? [] : ["frame"], { type: this.mimeType });
    this.dispatchEvent(event);
    this.dispatchEvent(new Event("stop"));
  }
}

function fixture(t) {
  const document = new EventTarget();
  document.hidden = false;
  t.mock.method(Recorder, "isTypeSupported", Recorder.isTypeSupported);
  const oldDocument = globalThis.document;
  const oldRecorder = globalThis.MediaRecorder;
  globalThis.document = document;
  globalThis.MediaRecorder = Recorder;
  t.after(() => {
    globalThis.document = oldDocument;
    globalThis.MediaRecorder = oldRecorder;
  });
  const video = { stopped: false, stop() { this.stopped = true; } };
  const tracks = [video];
  const canvas = { captureStream: () => ({ addTrack: (track) => tracks.push(track), getTracks: () => tracks, getVideoTracks: () => [video] }) };
  return { document, canvas, video };
}

test("finished capture includes final data and reports its actual container", async (t) => {
  const { canvas, video } = fixture(t);
  const audio = { readyState: "live", clone: () => ({ stop() { audio.cloneStopped = true; } }) };
  const recording = startCanvasRecording(canvas, { audioTrack: audio, videoBitsPerSecond: 1000 });
  recording.finish();
  const result = await recording.done;
  assert.equal(result.status, "ready");
  assert.equal(result.extension, "mp4");
  assert.equal(await result.blob.text(), "frame");
  assert.equal(video.stopped, true);
  assert.equal(audio.cloneStopped, true);
});

test("cancelled capture discards data even when the browser emits a final chunk", async (t) => {
  const { canvas, video } = fixture(t);
  const recording = startCanvasRecording(canvas, { videoBitsPerSecond: 1000 });
  recording.cancel();
  assert.deepEqual(await recording.done, { status: "cancelled" });
  assert.equal(video.stopped, true);
  assert.equal(Recorder.latest.state, "inactive");
});

test("hidden tabs abort capture rather than exporting frozen video", async (t) => {
  const { canvas, document, video } = fixture(t);
  const recording = startCanvasRecording(canvas, { videoBitsPerSecond: 1000 });
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  const result = await recording.done;
  assert.equal(result.status, "error");
  assert.match(result.message, /hidden/);
  assert.equal(video.stopped, true);
});

test("an unsolicited stop is treated as an interrupted export", async (t) => {
  const { canvas } = fixture(t);
  const recording = startCanvasRecording(canvas, { videoBitsPerSecond: 1000 });
  Recorder.latest.stop();
  assert.equal((await recording.done).status, "error");
});


test("an empty finished recording returns a retryable failure", async (t) => {
  const { canvas } = fixture(t);
  const recording = startCanvasRecording(canvas, { videoBitsPerSecond: 1000 });
  Recorder.latest.empty = true;
  recording.finish();
  assert.equal((await recording.done).reason, "empty");
});
