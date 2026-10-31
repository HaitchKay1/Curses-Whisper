/**
 * Local-only audio handoff. Audio is never put on the network text pubsub.
 * STT owns the microphone, model session and serialized inference queue.
 */
export type WhisperAudio = {
  model: string;
  language: string;
  isFinal: boolean;
  /** Only reuse output from a verified translate task, never a language setting. */
  englishText?: string;
  translate: (sourceLanguage?: string) => Promise<string>;
  isCurrent: () => boolean;
};

type AudioListener = (audio: WhisperAudio) => Promise<void>;
const listeners = new Set<AudioListener>();

export function subscribeWhisperAudio(listener: AudioListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Capture listeners now so a later start cannot receive an old utterance. */
export function captureWhisperTranslation() {
  const current = [...listeners];
  return async (audio: WhisperAudio) => {
    for (const listener of current) {
      if (listeners.has(listener) && audio.isCurrent()) await listener(audio);
    }
  };
}
