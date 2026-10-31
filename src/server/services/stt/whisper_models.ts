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
  { label: "Afrikaans", value: "af" },
  { label: "Albanian", value: "sq" },
  { label: "Amharic", value: "am" },
  { label: "Arabic", value: "ar" },
  { label: "Armenian", value: "hy" },
  { label: "Assamese", value: "as" },
  { label: "Azerbaijani", value: "az" },
  { label: "Bashkir", value: "ba" },
  { label: "Basque", value: "eu" },
  { label: "Belarusian", value: "be" },
  { label: "Bengali", value: "bn" },
  { label: "Bosnian", value: "bs" },
  { label: "Breton", value: "br" },
  { label: "Bulgarian", value: "bg" },
  { label: "Cantonese", value: "yue" },
  { label: "Catalan", value: "ca" },
  { label: "Chinese", value: "zh" },
  { label: "Croatian", value: "hr" },
  { label: "Czech", value: "cs" },
  { label: "Danish", value: "da" },
  { label: "Dutch", value: "nl" },
  { label: "English", value: "en" },
  { label: "Estonian", value: "et" },
  { label: "Faroese", value: "fo" },
  { label: "Finnish", value: "fi" },
  { label: "French", value: "fr" },
  { label: "Galician", value: "gl" },
  { label: "Georgian", value: "ka" },
  { label: "German", value: "de" },
  { label: "Greek", value: "el" },
  { label: "Gujarati", value: "gu" },
  { label: "Haitian Creole", value: "ht" },
  { label: "Hausa", value: "ha" },
  { label: "Hawaiian", value: "haw" },
  { label: "Hebrew", value: "he" },
  { label: "Hindi", value: "hi" },
  { label: "Hungarian", value: "hu" },
  { label: "Icelandic", value: "is" },
  { label: "Indonesian", value: "id" },
  { label: "Italian", value: "it" },
  { label: "Japanese", value: "ja" },
  { label: "Javanese", value: "jw" },
  { label: "Kannada", value: "kn" },
  { label: "Kazakh", value: "kk" },
  { label: "Khmer", value: "km" },
  { label: "Korean", value: "ko" },
  { label: "Lao", value: "lo" },
  { label: "Latin", value: "la" },
  { label: "Latvian", value: "lv" },
  { label: "Lingala", value: "ln" },
  { label: "Lithuanian", value: "lt" },
  { label: "Luxembourgish", value: "lb" },
  { label: "Macedonian", value: "mk" },
  { label: "Malagasy", value: "mg" },
  { label: "Malay", value: "ms" },
  { label: "Malayalam", value: "ml" },
  { label: "Maltese", value: "mt" },
  { label: "Maori", value: "mi" },
  { label: "Marathi", value: "mr" },
  { label: "Mongolian", value: "mn" },
  { label: "Myanmar", value: "my" },
  { label: "Nepali", value: "ne" },
  { label: "Norwegian", value: "no" },
  { label: "Nynorsk", value: "nn" },
  { label: "Occitan", value: "oc" },
  { label: "Pashto", value: "ps" },
  { label: "Persian", value: "fa" },
  { label: "Polish", value: "pl" },
  { label: "Portuguese", value: "pt" },
  { label: "Punjabi", value: "pa" },
  { label: "Romanian", value: "ro" },
  { label: "Russian", value: "ru" },
  { label: "Sanskrit", value: "sa" },
  { label: "Serbian", value: "sr" },
  { label: "Shona", value: "sn" },
  { label: "Sindhi", value: "sd" },
  { label: "Sinhala", value: "si" },
  { label: "Slovak", value: "sk" },
  { label: "Slovenian", value: "sl" },
  { label: "Somali", value: "so" },
  { label: "Spanish", value: "es" },
  { label: "Sundanese", value: "su" },
  { label: "Swahili", value: "sw" },
  { label: "Swedish", value: "sv" },
  { label: "Tagalog", value: "tl" },
  { label: "Tajik", value: "tg" },
  { label: "Tamil", value: "ta" },
  { label: "Tatar", value: "tt" },
  { label: "Telugu", value: "te" },
  { label: "Thai", value: "th" },
  { label: "Tibetan", value: "bo" },
  { label: "Turkish", value: "tr" },
  { label: "Turkmen", value: "tk" },
  { label: "Ukrainian", value: "uk" },
  { label: "Urdu", value: "ur" },
  { label: "Uzbek", value: "uz" },
  { label: "Vietnamese", value: "vi" },
  { label: "Welsh", value: "cy" },
  { label: "Yiddish", value: "yi" },
  { label: "Yoruba", value: "yo" },
];

export function whisperModelById(id: string) {
  return WHISPER_MODELS.find(m => m.id === id) ?? WHISPER_MODELS[0];
}

/** Turbo was not trained for translation; .en models only understand English. */
export function whisperSupportsTranslation(id: string): boolean {
  const model = WHISPER_MODELS.find(m => m.id === id);
  return !!model && !model.english && id !== "large-v3-turbo";
}

export function whisperLanguagesForModel(id: string) {
  // Cantonese has its own token in v3 models; older models have 99 languages.
  return WHISPER_LANGUAGES.filter(l => l.value !== "yue" || id.startsWith("large-v3"));
}

export function whisperTranslationError(model: string, language: string): string | undefined {
  if (!whisperSupportsTranslation(model))
    return "Whisper translation needs multilingual Tiny, Base, Small, Medium or Large. English-only (.en) and Turbo models cannot translate. Select a compatible model in Speech to Text.";
  if (!whisperLanguagesForModel(model).some(l => l.value === (language || "auto")))
    return "This source language is not supported by the selected Whisper model. Choose Auto detect or a supported language in Speech to Text.";
}
