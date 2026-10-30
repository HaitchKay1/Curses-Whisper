import { microphoneConstraints } from "../mic";
import { isEmptyValue } from "@/utils";
import { STT_State } from "../schema";
import {
  ISTTReceiver,
  ISTTService
} from "../types";

export class STT_NativeService implements ISTTService {
  constructor(private bindings: ISTTReceiver) {}
  
  #instance?: SpeechRecognition;
  #stream?: MediaStream;
  #stopped = false;
  
  dispose(): void {}
  
  #processResults = (event: any) => {
    let interim_transcript = "";
    let final_transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
        this.bindings.onFinal(final_transcript);
      } else {
        interim_transcript += event.results[i][0].transcript;
        this.bindings.onInterim(interim_transcript);
      }
    }
  };
  
  start(state: STT_State): void {
    if (Object.values(state.native).some(isEmptyValue))
      return this.bindings.onStop("Options missing");
    this.#stopped = false;

    const sp = window.webkitSpeechRecognition || window.SpeechRecognition;
    // Hold the chosen input open. Chromium's recognizer follows the active capture device when it can.
    navigator.mediaDevices.getUserMedia(microphoneConstraints(state.inputDevice)).then((stream) => {
      if (this.#stopped) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.#stream = stream;
      this.#startRecognition(sp, state);
    }).catch(() => {
      if (!this.#stopped) this.#startRecognition(sp, state);
    });
  }

  #startRecognition(sp: new () => SpeechRecognition, state: STT_State) {

    this.#instance = new sp();
    this.#instance.lang = state.native.language;
    this.#instance.continuous = true;
    this.#instance.interimResults = true;

    this.#instance.onstart = () => this.bindings.onStart();
    this.#instance.onresult = (event: any) => this.#processResults(event);
    
    this.#instance.addEventListener("error", (error) => {
      // listener for active connection
      if (error.error === "no-speech")
        return;
      this.stop(error.error);
    });
    this.#instance.onend = (e: any) => this.#instance?.start(); // keep alive
    this.#instance.start();

    window.onbeforeunload = () => this.#instance?.stop();
  }

  stop(error?: string): void {
    this.#stopped = true;
    this.#stream?.getTracks().forEach(track => track.stop());
    this.#stream = undefined;
    if (!this.#instance) {
      this.bindings.onStop(error);
      return;
    }
    this.#instance.onend = null;
    this.#instance.stop();
    this.#instance = undefined;
    this.bindings.onStop(error);
  }
}
