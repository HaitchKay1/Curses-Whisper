# Curses — Whisper fork

Unofficial fork of [Curses](https://github.com/mmpneo/curses) by [mmpneo](https://github.com/mmpneo).
The original app is theirs. The local Whisper speech-to-text integration and the shared microphone picker were written by Grok (xAI). The publisher of this fork did not write that code and only checked that the features ran.

This project is not affiliated with mmpneo, OpenAI, or xAI. It is licensed under AGPL-3.0, the same license as the original. There is no warranty. See the license for the full disclaimer of warranty and limitation of liability. Use it at your own risk.

<p align="center">
<img height="60" src="https://user-images.githubusercontent.com/3977499/218317016-0ebd9936-4065-4b6b-a0a0-1199d43c0024.svg">
</p>
<p align="center">Speech to Text Captions for OBS, VRChat, Twitch chat and Discord</p>
<p align="center">
  <a href="https://github.com/HaitchKay1/curses/releases/"><img src="https://img.shields.io/github/release/HaitchKay1/curses.svg?color=FC6471&label" alt="Release"></a>
</p>

## What this version adds

- **Offline speech-to-text.** Whisper runs on your computer through whisper.cpp. No API key. After the model is downloaded, captions keep working without internet.
- **Every common model.** Tiny, Base, Small, Medium, Large v1, Large v2, Large v3, and Turbo, plus English-only Tiny, Base, Small, and Medium. Each option shows its download size (about 74 MB for Tiny, up to about 2.9 GB for Large).
- **Models stay next to the app.** The first time you pick a model, Curses downloads it into a `Models` folder beside the program. The Whisper runtime is downloaded into that same folder the first time you start it.
- **Language controls.** Auto-detect, or pick a language. Multilingual models can translate speech into English. English-only models stay in English.
- **One microphone for the whole app.** The menu at the top of Speech to text lists every input on the computer. It starts on the system default and is used by Whisper, Azure, Deepgram, Speechly, Native, and the browser caption page.

Everything else matches upstream Curses.

# Features
- **OBS Captions customization**: Colors, fonts, shadows, background textures, text typing animation, sound effects, particle effects and CSS
- **Native OBS stream captions**
- **Google Fonts**: more than 1000 free fonts for OBS captions
- **Speech to Text**: [Microsoft Azure](https://azure.microsoft.com/en-au/products/cognitive-services/speech-to-text/), [Speechly](https://www.speechly.com/), [Deepgram](https://deepgram.com/), [OpenAI Whisper](https://github.com/openai/whisper) (local, Tiny through Large and Turbo), WebSpeechApi (Chrome and Edge)
- **Microphone picker**: one input device for every speech-to-text service, defaulting to the system microphone
- **Text to Speech**: [Microsoft Azure](https://azure.microsoft.com/en-us/products/cognitive-services/text-to-speech/), [Uberduck](https://uberduck.ai/), TikTok, Windows Api (SAPI), WebSpeechApi
- **VRChat**: [KillFrenzy Avatar text](https://github.com/killfrenzy96/KillFrenzyAvatarText), vrchat's chatbox
- **Twitch**:
  - Use 7TV/FFZ/BTTV emotes in OBS captions
  - Post your STT to chat
  - Use your chat messages as a source for captions and TTS
  - native captions
- **Discord**: Send your STT to specified channel
- **Scenes**:
  - Save multiple designs and freely switch between them
  - Automatically switch design when OBS changes scene

# Get this version

Download `curses_0.0.20_x64-setup.exe` (or the `.msi`) from [this fork's releases](https://github.com/HaitchKay1/curses/releases). Do not use the [original installer](https://github.com/mmpneo/curses/releases/latest). That build does not include Whisper.

Windows may warn that the installer is unrecognized because it is not code-signed. The first time you choose a Whisper model, leave the app online until that model and the runtime finish downloading.

# Getting Started with OBS
### 1. Install the app
Use the installer from [this fork's releases](https://github.com/HaitchKay1/curses/releases).

### 2. Open app and copy link for OBS
Or click "Set Up OBS" to have everything set up automatically with **obs-websocket** plugin

<img width="600" src="https://user-images.githubusercontent.com/3977499/218330675-472e02a9-1e18-4d60-8662-c4ca33325c24.gif">

### 3. Create browser source in OBS
Paste the link and change window size to match app's canvas size (default is 500x300)

<img width="600" src="https://user-images.githubusercontent.com/3977499/218331723-721b69c5-a457-4dad-9658-f5232afc68f1.gif">

## Roadmap
- [ ] STT - Vosk
- [x] STT - OpenAI Whisper
- [ ] TTS - VoiceVox

## OpenAI Whisper
Whisper is a local speech-to-text service. Pick a model from the Speech to text service menu (Tiny, Base, Small, Medium, Large v1–v3, and Turbo, plus English-only builds).

The first time you select a model, Curses downloads it into a `Models` folder next to the program (`Curses.exe` on Windows). The Whisper runtime is downloaded into that same folder the first time you start Whisper. After that, recognition works offline.

The microphone menu at the top of Speech to text lists every input on the computer. **System default** follows the microphone chosen in your operating system settings and is used by Whisper, Azure, Deepgram, Speechly, Native, and the browser caption page.

# Original project
Curses was created by [mmpneo](https://github.com/mmpneo). Their community, streams, and support channels are theirs, not a support desk for this fork:

- [Discord](https://discord.gg/Sw6pw8fGYS)
- [Twitch](https://www.twitch.tv/mmpcode)
- [Patreon](https://patreon.com/mmpcode)
