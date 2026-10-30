/** Keep ids in sync with src-tauri/src/services/whisper/mod.rs */
export type WhisperModelInfo = {
  id: string;
  label: string;
  size: string;
  english: boolean;
};

export const WHISPER_MODELS: WhisperModelInfo[] = [
  { id: "tiny", label: "Tiny", size: "74 MB", english: false },
  { id: "tiny.en", label: "Tiny (English)", size: "74 MB", english: true },
  { id: "base", label: "Base", size: "141 MB", english: false },
  { id: "base.en", label: "Base (English)", size: "141 MB", english: true },
  { id: "small", label: "Small", size: "465 MB", english: false },
  { id: "small.en", label: "Small (English)", size: "465 MB", english: true },
  { id: "medium", label: "Medium", size: "1.5 GB", english: false },
  { id: "medium.en", label: "Medium (English)", size: "1.5 GB", english: true },
  { id: "large-v1", label: "Large v1", size: "2.9 GB", english: false },
  { id: "large-v2", label: "Large v2", size: "2.9 GB", english: false },
  { id: "large-v3", label: "Large v3", size: "2.9 GB", english: false },
  { id: "large-v3-turbo", label: "Turbo", size: "1.5 GB", english: false },
];

export const WHISPER_LANGUAGES: { label: string; value: string }[] = [
  { label: "Auto detect", value: "auto" },
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Portuguese", value: "pt" },
  { label: "Dutch", value: "nl" },
  { label: "Polish", value: "pl" },
  { label: "Russian", value: "ru" },
  { label: "Ukrainian", value: "uk" },
  { label: "Chinese", value: "zh" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Arabic", value: "ar" },
  { label: "Hindi", value: "hi" },
  { label: "Turkish", value: "tr" },
  { label: "Vietnamese", value: "vi" },
  { label: "Indonesian", value: "id" },
  { label: "Thai", value: "th" },
  { label: "Swedish", value: "sv" },
  { label: "Norwegian", value: "no" },
  { label: "Danish", value: "da" },
  { label: "Finnish", value: "fi" },
  { label: "Czech", value: "cs" },
  { label: "Greek", value: "el" },
  { label: "Hebrew", value: "he" },
  { label: "Romanian", value: "ro" },
  { label: "Hungarian", value: "hu" },
  { label: "Catalan", value: "ca" },
];

export function whisperModelById(id: string) {
  return WHISPER_MODELS.find(m => m.id === id) ?? WHISPER_MODELS[0];
}
