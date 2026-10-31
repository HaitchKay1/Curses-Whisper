# Curses — Whisper fork

Local speech-to-text and English translation for OBS captions, VRChat, Twitch chat and Discord.

[Download the latest Windows release](https://github.com/HaitchKay1/Curses-Whisper/releases/latest) · [Repository](https://github.com/HaitchKay1/Curses-Whisper) · [Builds](https://github.com/HaitchKay1/Curses-Whisper/actions) · [License](https://github.com/HaitchKay1/Curses-Whisper/blob/master/LICENSE.md)

<p align="center">
<img height="60" src="https://user-images.githubusercontent.com/3977499/218317016-0ebd9936-4065-4b6b-a0a0-1199d43c0024.svg">
</p>
<p align="center">
<a href="https://github.com/HaitchKay1/Curses-Whisper/releases/latest"><img src="https://img.shields.io/github/v/release/HaitchKay1/Curses-Whisper?color=FC6471" alt="Latest release"></a>
</p>

## What this fork adds

- **Local Whisper speech-to-text:** no API key or paid transcription service. Once the model and runtime are downloaded, processing works offline.
- **Speech translation into English:** the Translation tab reuses the microphone, downloaded model and running Whisper session. Original-language transcription and English translation can be used as separate text sources.
- **NVIDIA GPU acceleration:** Automatic uses CUDA on 64-bit Windows. Both transcription and translation use the same GPU model. CPU processing remains available as an explicit option.
- **Visible processing status:** the app verifies GPU model allocation and displays the active processing device. Translation shows progress and a Latest English translation preview.
- **Model and language choices:** Tiny, Base, Small, Medium, Large v1–v3 and Turbo, plus English-only Tiny, Base, Small and Medium. Source languages include Auto detect and the languages supported by the selected model.
- **One microphone picker:** choose the input used by Whisper, Azure, Deepgram, Speechly, Native and the browser caption page.
- **Process cleanup:** Whisper stops when Curses fully exits. Windows also ties the owned server process to Curses so it is terminated on force-close.
- **Reduced interim backlog:** intermediate caption requests do not accumulate behind busy Whisper inference.

Version **0.0.23** brings the translation, CUDA and shutdown changes into this repository, together with corrected links and setup instructions.

## Download and install

Download the `*-setup.exe` or `.msi` from [Curses-Whisper releases](https://github.com/HaitchKay1/Curses-Whisper/releases/latest). Use the setup EXE for a normal Windows installation.

The installers are unsigned, so Windows may show an unrecognized-app warning. Fully close an older Curses instance before installing or starting the update.

On first use, stay online while the model and runtime download. Models are saved in a `Models` folder beside the program when writable, with an application-data fallback otherwise. Existing models are reused. The app shows the actual folder in Speech to Text.

## Speech to Text setup

1. Open **Speech to Text** and select your microphone.
2. Choose a Whisper model from the service menu and wait for its download.
3. Choose the spoken language, or **Auto detect**.
4. Select the processing device, then start Speech to Text.

Smaller models need less memory and usually process faster; larger models generally provide better accuracy. Tiny can produce poor translations, especially with short or unclear audio. Actual speed depends on the model, GPU memory and other GPU workloads.

## Translate speech into English

**Speech to Text and Translation must both be running.** Translation uses Speech to Text's captured audio; it does not open a separate microphone.

1. In **Speech to Text**, choose a multilingual model: Tiny, Base, Small, Medium, Large v1, Large v2 or Large v3.
2. Start Speech to Text. Leave its own translate-to-English switch off if you want original-language transcription alongside a separate English translation.
3. In **Translation**, select **OpenAI Whisper → English (offline)**.
4. Set **Spoken language → English** to **Auto detect** or your spoken language, then start Translation. This language setting is independent of Speech to Text.
5. Speak a sentence and pause briefly. Check **Latest English translation** in the Translation tab.
6. Set the destination caption or output's **Text source** to **Translation**.

### Show the translation in the caption overlay

Starting Translation does **not** automatically change your existing caption source:

1. Click the caption/text element in the Curses canvas.
2. Open its **Source** settings.
3. Change **Text source** from **Speech to text** to **Translation**.
4. Speak another sentence. Earlier results are not replayed automatically.

For OBS native stream captions, VRChat, TTS or other destinations that offer a source selector, select **Translation** in that destination's settings as well. An OBS browser source follows the text element configured in the Curses canvas.

### Translation limits

- Whisper translates **spoken audio into English**, not typed/pasted text or another speech provider's transcript. Azure remains available for text translation.
- English-only `.en` models and **Turbo** are not supported for translation. Turbo remains available for transcription.
- Translation defaults to completed sentences. Interim translation requires interim results enabled in both tabs and adds processing load.
- Original-language transcription plus English translation requires two inference passes through the same loaded model. An already-verified English translation can be reused.
- If the left-side preview is English but the overlay is not, check the overlay's **Text source** setting.
- Accuracy varies by language, model and recording conditions. See [translation details](WHISPER-TRANSLATION.md).

## NVIDIA GPU / CPU options

In **Speech to Text → Whisper processing device**, choose:

| Option | Behavior |
| --- | --- |
| Automatic | NVIDIA CUDA on 64-bit Windows; CPU on other platforms. |
| NVIDIA GPU (CUDA) | Explicitly use the Windows x64 CUDA runtime. |
| CPU | Run Whisper on the CPU. |

Leave **CUDA GPU index** at `0` for the default NVIDIA GPU. On a multi-GPU system, select the CUDA index of the intended GPU. Stop and restart Speech to Text after changing the device or model.

The first CUDA start downloads approximately **685 MB** of runtime files, including the required CUDA libraries. A compatible NVIDIA driver is required; installing the CUDA Toolkit separately is not required. CPU and CUDA runtimes are cached separately so an older CPU runtime cannot override the GPU selection.

After startup, look for **GPU: NVIDIA CUDA0 (CUDA, model allocation verified)**, or the selected device index. Translation uses and displays that same processing device. If CUDA initialization cannot be verified, the app reports an error rather than silently switching to CPU. Check `whisper-server.log` in the Models folder, the NVIDIA driver, available VRAM and the device index; CPU can be selected explicitly.

Audio capture, the UI and some small processing operations still use the CPU. Automatic AMD/Intel GPU acceleration is not implemented. See [GPU and shutdown details](WHISPER-GPU.md).

## OBS setup

1. Install [Curses-Whisper](https://github.com/HaitchKay1/Curses-Whisper/releases/latest).
2. Open the app and copy its OBS link, or use **Set Up OBS** with obs-websocket.
3. Add a **Browser source** in OBS, paste the link and match the dimensions to the Curses canvas (default 500×300).
4. Configure the caption element's **Text source** in Curses: **Speech to text** for transcription or **Translation** for English translation.

<img width="600" src="https://user-images.githubusercontent.com/3977499/218330675-472e02a9-1e18-4d60-8662-c4ca33325c24.gif">

<img width="600" src="https://user-images.githubusercontent.com/3977499/218331723-721b69c5-a457-4dad-9658-f5232afc68f1.gif">

## Other Curses features

- Customizable OBS captions: colors, fonts, shadows, backgrounds, typing animations, sound effects, particles and CSS.
- Native OBS stream captions and Google Fonts support.
- Additional STT providers: Microsoft Azure, Speechly, Deepgram and browser Web Speech APIs.
- TTS providers: Microsoft Azure, Uberduck, TikTok, Windows SAPI and browser Web Speech APIs.
- VRChat chatbox and [KillFrenzy Avatar Text](https://github.com/killfrenzy96/KillFrenzyAvatarText).
- Twitch chat integration, 7TV/FFZ/BTTV emotes and captions.
- Discord text output and multiple caption-design scenes, including OBS scene switching.

## Build from source

Clone [this repository](https://github.com/HaitchKay1/Curses-Whisper):

```powershell
git clone https://github.com/HaitchKay1/Curses-Whisper.git
cd Curses-Whisper
npm install --global pnpm@9
npm ci --legacy-peer-deps
pnpm tauri build
```

Windows builds require Node.js 20, Rust, Microsoft C++ build tools and WebView2. `--legacy-peer-deps` accommodates an existing Vite plugin peer-dependency mismatch.

Installers are produced under `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`. The [release workflow](https://github.com/HaitchKay1/Curses-Whisper/actions/workflows/release.yml) runs tests, builds the installers and publishes them to [this repository's releases](https://github.com/HaitchKay1/Curses-Whisper/releases).

## Credits and license

This is an unofficial fork of [Curses](https://github.com/mmpneo/curses), created by [mmpneo](https://github.com/mmpneo). The original local Whisper integration and shared microphone picker were written with Grok (xAI). The separate translation service, CUDA options, process cleanup and subsequent fixes were added with ChatGPT/Codex (OpenAI).

This fork is not affiliated with mmpneo, OpenAI or xAI. It retains the original [AGPL-3.0 license](https://github.com/HaitchKay1/Curses-Whisper/blob/master/LICENSE.md), including its warranty disclaimer. Upstream community and support channels belong to the original project:

- [Discord](https://discord.gg/Sw6pw8fGYS)
- [Twitch](https://www.twitch.tv/mmpcode)
- [Patreon](https://patreon.com/mmpcode)
