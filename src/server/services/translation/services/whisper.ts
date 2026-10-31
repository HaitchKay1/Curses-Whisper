import { TextEvent, TextEventSource, TextEventType } from "@/types";
import { subscribeWhisperAudio, WhisperAudio } from "../../stt/whisper_audio";
import { whisperTranslationError } from "../../stt/whisper_models";
import { Translation_State } from "../schema";
import { ITranslationReceiver, ITranslationService } from "../types";

export class Translation_WhisperService implements ITranslationService {
  constructor(private receiver: ITranslationReceiver) {}

  #unsubscribe?: () => void;
  #generation = 0;
  #interim = false;
  #language = "auto";

  #progress(value: string) {
    window.ApiServer.translation.serviceState.whisperProgress = value;
  }

  start(state: Translation_State): void {
    const stt = window.ApiServer.state.services.stt.data;
    if (stt.backend !== "whisper") {
      this.receiver.onStop("Select OpenAI Whisper in Speech to Text first.");
      return;
    }
    this.#language = state.whisper.language || "auto";
    const error = whisperTranslationError(stt.whisper.model, this.#language);
    if (error) {
      this.receiver.onStop(error);
      return;
    }
    this.#interim = state.whisper.interim;
    this.#unsubscribe = subscribeWhisperAudio(audio => this.#translateAudio(audio));
    window.ApiServer.translation.serviceState.whisperLastResult = "";
    this.#progress("Waiting for speech from Whisper Speech to Text…");
    this.receiver.onStart();
  }

  async #translateAudio(audio: WhisperAudio): Promise<void> {
    if (!audio.isFinal && !this.#interim) return;
    const generation = this.#generation;
    const current = () => !!this.#unsubscribe && generation === this.#generation && audio.isCurrent();
    try {
      const error = whisperTranslationError(audio.model, this.#language);
      if (error) throw new Error(error);
      this.#progress("Translating speech to English…");
      const value = (audio.englishText ?? await audio.translate(this.#language)).trim();
      if (!current()) return;
      if (!value) {
        this.#progress("No English text returned for this audio. Try a longer sentence or a larger multilingual model.");
        return;
      }
      window.ApiServer.translation.serviceState.whisperLastResult = value;
      this.#progress("English translation ready — use Translation as the caption/output source.");
      window.ApiShared.pubsub.publishText(TextEventSource.translation, {
        value,
        type: audio.isFinal ? TextEventType.final : TextEventType.interim,
      });
    } catch (error) {
      if (!current()) return;
      this.#disconnect();
      this.#progress("Translation failed");
      this.receiver.onStop(error instanceof Error ? error.message : String(error));
    }
  }

  // Whisper translates audio, never transcripts or keyboard input.
  translate(_id: number, _value: TextEvent): void {}

  #disconnect(): void {
    this.#generation++;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }
  stop(): void {
    this.#disconnect();
    this.#progress("Stopped");
    this.receiver.onStop();
  }
  dispose(): void { this.#disconnect(); }
}
