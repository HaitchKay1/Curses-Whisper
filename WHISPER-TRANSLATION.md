# Whisper translation to English

Version 0.0.23 includes the tested translation and GPU changes in
[HaitchKay1/Curses-Whisper](https://github.com/HaitchKay1/Curses-Whisper).

The Translation tab offers **OpenAI Whisper → English (offline)**. It uses the
same selected model, downloaded model files, microphone and local Whisper
session as Speech to Text. No API key or second model download is required.
Whisper translates audio, not typed text or another provider's transcript.

## Use it after building

1. In Speech to Text, choose a multilingual Whisper model: Tiny, Base, Small,
   Medium, Large v1, Large v2 or Large v3. Let its existing download finish.
   English-only `.en` models and Turbo are excluded from translation.
2. Set the source language or select Auto detect. The list now includes every
   Whisper language token supported by the selected model (99 languages for
   older multilingual models; 100 for Large v3, including Cantonese).
3. Leave Speech to Text's existing “translate to English” switch off if you want
   original-language STT captions alongside separate English translations.
   If it is on, the English result is reused without a second inference.
4. Start Speech to Text.
5. In Translation, choose OpenAI Whisper → English (offline), set Spoken language
   to Auto detect (or your spoken language), then Start. This setting is independent
   of the Speech to Text language.
6. Check Latest English translation in the Translation tab. Select the app's
   Translation text source in your caption/output settings.
   Speak into the microphone selected in Speech to Text.

You can arm Translation before starting Whisper. It waits for audio and resumes
when Speech to Text resumes. Stopping Translation leaves Speech to Text running.
Stopping or muting Speech to Text suppresses English output as well.

Translation defaults to final sentences. Interim translation requires interim
results enabled in both tabs. Original transcription plus translation takes two
serial inference passes, so larger models and interim output can add substantial
latency. Accuracy varies by model, language and recording conditions.

## Build on Windows

Use the original project's Windows prerequisites: Node.js, pnpm 9, Rust, Microsoft
C++ build tools and WebView2. Extract the source to a new folder, then run from
that folder:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build
```

Installers are written under:

- `src-tauri/target/release/bundle/nsis/` (setup EXE)
- `src-tauri/target/release/bundle/msi/` (MSI)

The release workflow also builds installers and publishes them to
https://github.com/HaitchKay1/Curses-Whisper/releases.

## Validation and implementation notes

- TypeScript checking and Vite production build passed with the npm lockfile.
- Twelve automated tests passed: audio output routing, typed-input exclusion,
  model/language guards, interim filtering, English-result reuse, stale result
  suppression across stop/restart, mute/stop suppression, empty output, and errors.
- Test command: `npx playwright test tests/whisper-translation.spec.ts --project=chromium --reporter=list`.
  These are service tests with mocked audio inference; they do not launch Chromium
  or validate model accuracy.
- npm dependency installation required `npm ci --legacy-peer-deps` because the
  existing package pins an older React Vite plugin alongside Vite 5. Neither
  dependency manifest nor lockfile was modified.
- Two small pre-existing TypeScript compatibility problems in file/audio loading
  were fixed by copying typed arrays into owned ArrayBuffers. They accounted for
  three compiler errors with the npm lockfile's current TypeScript version.
- Audio translation uses the shared Whisper backend with `translate: true`,
  serialized with STT inference. Version 0.0.21 adds CUDA acceleration and
  owned-process cleanup; see WHISPER-GPU.md. Audio stays out
  of the network text pubsub; only the resulting English text is published.
- The preceding 0.0.22 Windows installer build and native tests passed GitHub
  Actions. Hardware performance has not been benchmarked. This release reruns
  the tests and installer build in Curses-Whisper.
- New UI help text uses English fallbacks in all three existing locale files.

Model capability reference: https://github.com/openai/whisper#command-line-usage
Language list: https://github.com/openai/whisper/blob/main/whisper/tokenizer.py


## 0.0.22 translation correction

An English STT source-language setting previously caused raw transcription to be
reused as English output without running translation. Translation now detects the
spoken language independently (Auto detect by default); choosing English in STT
no longer skips the translation request. Only output from an acknowledged
Whisper translate task can be reused. A transcription response to a translation
request now produces a visible error instead of being labelled as translated.

The Translation tab shows processing status and the most recent result directly.
If that preview is English but a caption remains in the original language, change
that caption/output's text source from Speech to Text to Translation.

The frontend build and 12 service tests pass, including independent source-language
selection. A local smoke test sends synthesized Spanish audio through the pinned
b5454 server, first as transcription and then as an actual translate request.
This validates that the runtime acknowledges translate tasks and returns English,
not translation accuracy: Tiny and Base produced inaccurate English on the short
synthetic sample. This is not a Windows microphone or model accuracy benchmark.
