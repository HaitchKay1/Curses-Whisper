# Whisper GPU acceleration

The old launcher always supplied `--no-gpu` and downloaded the CPU runtime.
This version uses the official whisper.cpp b5454 CUDA 12.4 Windows x64 runtime
for the default Automatic setting on 64-bit Windows. It retains existing GGML
models and uses the same GPU session for transcription and English translation.

## Use

1. Install the new Windows build and fully close the previous Curses instance.
2. In Speech to Text, select your Whisper model.
3. Leave **Whisper processing device** on **Automatic (NVIDIA CUDA on Windows)**,
   or explicitly choose **NVIDIA GPU (CUDA)**. GPU index 0 is the default. On a
   multi-GPU machine, choose the CUDA index of the intended NVIDIA GPU.
4. Start Speech to Text. The first CUDA start downloads about 685 MB of runtime
   files and bundled CUDA libraries. It does not redownload existing models.
5. Confirm the status shows **GPU: NVIDIA CUDA0 (CUDA, model allocation verified)**
   (or the selected index). Translation displays the same active device.

CUDA is appropriate for the user's RTX 4080. An NVIDIA driver compatible with
CUDA 12.4 is needed; the CUDA Toolkit does not need to be installed separately.
This automatic GPU runtime is for Windows x64 and NVIDIA GPUs. Other platforms
retain CPU mode under Automatic. AMD/Intel GPU acceleration is not implemented.

If GPU startup fails, Curses displays an error instead of silently using CPU.
Check the Models folder's `whisper-server.log`, the NVIDIA driver, available GPU
memory and GPU index. CPU remains available as an explicit selection. Changing
the device or model requires stopping and restarting Speech to Text.

CPU work for audio capture, WAV encoding, UI and small inference operations is
normal. The expensive Whisper model computation is offloaded to CUDA. Actual
latency depends on model size, available VRAM and other GPU workloads. No hardware
speedup measurement was performed in the development environment.

Original-language transcription plus English translation still requires two
inference passes. Both use the same loaded GPU model. If STT already produces
English, that result is reused. Interim jobs no longer accumulate behind busy
inference; final sentences remain queued in order.

## Runtime migration and shutdown

- CPU and CUDA runtimes live in separate, versioned folders underneath Models/runtime.
  A cached CPU executable from an older release cannot override the CUDA selection.
- A ready marker is written only after successful extraction. An interrupted
  runtime download/extraction can be retried on the next start.
- Normal app exit and the app's close command explicitly stop and reap the owned
  Whisper child. Closing while loading cancels startup.
- On Windows, the child belongs to a non-inherited Job Object with
  KILL_ON_JOB_CLOSE. Windows terminates the owned server and its descendants when
  Curses exits or is force-terminated after the child has been assigned to the job.
- Session IDs prevent a delayed Stop from an old microphone session from killing
  its replacement. Only this instance's child is targeted; no process-name-wide
  termination is used.
- An orphan from an older Curses version is not adopted or killed by this update.
  If one is already running, close it once in Task Manager before testing.

## Build and validation

The **release** workflow builds installers when the app version changes on
master, on version tags, or when run manually. It publishes the installers to
https://github.com/HaitchKay1/Curses-Whisper/releases and uploads a versioned
Curses-Whisper-Windows artifact. The CUDA runtime is downloaded at first use and
is not included in the installer.

Local checks cover the frontend build, translation service tests, native runtime
selection and CUDA-log verification, and child-process cleanup. Windows Job
Object tests and the full Windows installer build run in the workflow. Real
RTX 4080 inference and driver compatibility must be verified on the user's PC.

Pinned upstream runtime:
https://github.com/ggml-org/whisper.cpp/releases/tag/b5454
