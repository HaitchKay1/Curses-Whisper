import { invoke } from "@tauri-apps/api/tauri";
import { ISTTReceiver, ISTTService } from "../types";
import { STT_State } from "../schema";
import { microphoneConstraints } from "../mic";
import { whisperModelById } from "../whisper_models";

type VerboseSegment = { text?: string; no_speech_prob?: number };

function cleanWebTranscript(value: { text?: string; segments?: VerboseSegment[] }): string {
  const segments = value.segments;
  if (segments?.length) {
    return segments
      .filter(segment => (segment.no_speech_prob ?? 0) < 0.75)
      .map(segment => (segment.text || "").trim())
      .filter(text => text && !isCaptionNoise(text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const text = (value.text || "").trim();
  return isCaptionNoise(text) ? "" : text;
}

function isCaptionNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if ((trimmed.startsWith("(") && trimmed.endsWith(")")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true;
  const lower = trimmed.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return [
    "thanks for watching",
    "thank you for watching",
    "thanks for listening",
    "please subscribe",
  ].includes(lower);
}

async function transcribeWav(wav: Uint8Array, language: string, translate: boolean): Promise<string> {
  if (window.Config.isApp()) {
    return invoke<string>("plugin:whisper|transcribe", {
      wavBase64: bytesToBase64(wav),
      language,
      translate,
    });
  }
  const body = new FormData();
  const buffer = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
  body.append("file", new Blob([buffer], { type: "audio/wav" }), "speech.wav");
  body.append("response_format", "verbose_json");
  body.append("temperature", "0");
  body.append("temperature_inc", "0");
  body.append("language", language || "auto");
  body.append("translate", translate ? "true" : "false");
  body.append("suppress_nst", "true");
  body.append("no_speech_thold", "0.6");
  const response = await fetch("/api/whisper/inference", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text() || "Whisper preview failed");
  return cleanWebTranscript(await response.json());
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

function rms(input: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  return Math.sqrt(sum / Math.max(1, input.length));
}

export class STT_WhisperService implements ISTTService {
  constructor(private bindings: ISTTReceiver) {}

  #stopped = false;
  #ctx?: AudioContext;
  #stream?: MediaStream;
  #processor?: ScriptProcessorNode;
  #chain: Promise<void> = Promise.resolve();
  #speech: number[] = [];
  #preroll: number[] = [];
  #inSpeech = false;
  #silenceSamples = 0;
  #lastInterimAt = 0;

  dispose(): void {}

  get state() {
    return window.ApiServer.state.services.stt.data;
  }

  async start(_state: STT_State): Promise<void> {
    this.#stopped = false;
    const model = this.state.whisper.model || "tiny";
    try {
      if (window.Config.isApp()) {
        await invoke("plugin:whisper|ensure_session", { model });
      } else if (model !== "tiny") {
        throw new Error("This preview can try Whisper Tiny. Other models download in the desktop app, into the Models folder next to Curses.");
      } else {
        const health = await fetch("/api/whisper/health");
        if (!health.ok) throw new Error("Whisper is still starting. Press start again in a moment.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.bindings.onStop(message || "Could not start Whisper");
      return;
    }
    if (this.#stopped) {
      if (window.Config.isApp()) invoke("plugin:whisper|stop_session").catch(() => {});
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia(
        microphoneConstraints(this.state.inputDevice)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Microphone error";
      this.bindings.onStop(message);
      if (window.Config.isApp()) invoke("plugin:whisper|stop_session").catch(() => {});
      return;
    }
    if (this.#stopped) {
      this.#releaseMic();
      if (window.Config.isApp()) invoke("plugin:whisper|stop_session").catch(() => {});
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.#ctx = new AudioCtx();
    const source = this.#ctx.createMediaStreamSource(this.#stream);
    this.#processor = this.#ctx.createScriptProcessor(4096, 1, 1);
    const mute = this.#ctx.createGain();
    mute.gain.value = 0;
    this.#processor.onaudioprocess = (event) => this.#onAudio(event);
    source.connect(this.#processor);
    this.#processor.connect(mute);
    mute.connect(this.#ctx.destination);
    this.bindings.onStart();
  }

  #onAudio(event: AudioProcessingEvent) {
    if (this.#stopped || !this.#ctx) return;
    const raw = event.inputBuffer.getChannelData(0);
    const chunk = resample(new Float32Array(raw), this.#ctx.sampleRate, 16000);
    const energy = rms(chunk);
    const silenceSec = parseFloat(this.state.whisper.silenceTimeout) || 0.8;
    const silenceLimit = Math.round(Math.max(0.3, silenceSec) * 16000);
    const threshold = 0.012;

    if (!this.#inSpeech) {
      this.#preroll.push(...chunk);
      const maxPre = Math.round(0.45 * 16000);
      if (this.#preroll.length > maxPre) this.#preroll.splice(0, this.#preroll.length - maxPre);
      if (energy >= threshold) {
        this.#inSpeech = true;
        this.#speech = this.#preroll.slice();
        this.#silenceSamples = 0;
      }
      return;
    }

    for (let i = 0; i < chunk.length; i++) this.#speech.push(chunk[i]);
    if (energy >= threshold) this.#silenceSamples = 0;
    else this.#silenceSamples += chunk.length;

    const maxSpeech = 18 * 16000;
    if (this.#speech.length >= maxSpeech) {
      const copy = Float32Array.from(this.#speech);
      this.#resetUtterance();
      this.#queue(copy, true);
      return;
    }
    if (this.#silenceSamples >= silenceLimit) {
      const copy = Float32Array.from(this.#speech);
      this.#resetUtterance();
      if (copy.length > 0.35 * 16000) this.#queue(copy, true);
      return;
    }
    if (this.state.whisper.interim && this.#speech.length > 16000 && Date.now() - this.#lastInterimAt > 2000) {
      this.#lastInterimAt = Date.now();
      this.#queue(Float32Array.from(this.#speech), false);
    }
  }

  #resetUtterance() {
    this.#speech = [];
    this.#preroll = [];
    this.#inSpeech = false;
    this.#silenceSamples = 0;
  }

  #queue(samples: Float32Array, isFinal: boolean) {
    this.#chain = this.#chain
      .then(() => this.#transcribe(samples, isFinal))
      .catch(() => {});
  }

  async #transcribe(samples: Float32Array, isFinal: boolean) {
    if (this.#stopped) return;
    const info = whisperModelById(this.state.whisper.model);
    const language = info.english ? "en" : (this.state.whisper.language || "auto");
    const translate = info.english ? false : !!this.state.whisper.translate;
    const wav = encodeWav(samples, 16000);
    let text = "";
    try {
      text = await transcribeWav(wav, language, translate);
    } catch (error) {
      if (this.#stopped) return;
      const message = error instanceof Error ? error.message : String(error);
      this.bindings.onStop(message || "Whisper transcription failed");
      this.stop();
      return;
    }
    text = (text || "").trim();
    if (!text || this.#stopped) return;
    if (isFinal) this.bindings.onFinal(text);
    else this.bindings.onInterim(text);
  }

  #releaseMic() {
    this.#processor?.disconnect();
    this.#processor = undefined;
    this.#stream?.getTracks().forEach(track => track.stop());
    this.#stream = undefined;
    this.#ctx?.close().catch(() => {});
    this.#ctx = undefined;
  }

  stop(): void {
    this.#stopped = true;
    this.#resetUtterance();
    this.#releaseMic();
    if (window.Config.isApp()) invoke("plugin:whisper|stop_session").catch(() => {});
    this.bindings.onStop();
  }
}
