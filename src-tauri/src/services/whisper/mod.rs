mod acceleration;
mod process;
use acceleration::{Backend, verified_cuda_device};
use process::WhisperProcess;

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::Engine;
use futures::StreamExt;
use serde::Serialize;
use tauri::{
    command,
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};
use tokio::io::AsyncWriteExt;

const RUNTIME_TAG: &str = "b5454";

struct ModelSpec {
    id: &'static str,
    file: &'static str,
    bytes: u64,
}

const MODELS: &[ModelSpec] = &[
    ModelSpec { id: "tiny", file: "ggml-tiny.bin", bytes: 77_691_713 },
    ModelSpec { id: "tiny.en", file: "ggml-tiny.en.bin", bytes: 77_704_715 },
    ModelSpec { id: "base", file: "ggml-base.bin", bytes: 147_951_465 },
    ModelSpec { id: "base.en", file: "ggml-base.en.bin", bytes: 147_964_211 },
    ModelSpec { id: "small", file: "ggml-small.bin", bytes: 487_601_967 },
    ModelSpec { id: "small.en", file: "ggml-small.en.bin", bytes: 487_614_201 },
    ModelSpec { id: "medium", file: "ggml-medium.bin", bytes: 1_533_763_059 },
    ModelSpec { id: "medium.en", file: "ggml-medium.en.bin", bytes: 1_533_774_781 },
    ModelSpec { id: "large-v1", file: "ggml-large-v1.bin", bytes: 3_094_623_691 },
    ModelSpec { id: "large-v2", file: "ggml-large-v2.bin", bytes: 3_094_623_691 },
    ModelSpec { id: "large-v3", file: "ggml-large-v3.bin", bytes: 3_095_033_483 },
    ModelSpec { id: "large-v3-turbo", file: "ggml-large-v3-turbo.bin", bytes: 1_624_555_275 },
];

#[derive(Clone, Serialize)]
struct DownloadEvent {
    model: String,
    phase: String,
    received: u64,
    total: u64,
    done: bool,
    message: String,
}

struct WhisperState {
    child: Mutex<Option<WhisperProcess>>,
    session_lock: tokio::sync::Mutex<()>,
    generation: AtomicU64,
    exiting: AtomicBool,
    port: Mutex<Option<u16>>,
    running_model: Mutex<Option<String>>,
    dl_lock: tokio::sync::Mutex<()>,
    rt_lock: tokio::sync::Mutex<()>,
    dl_model: Mutex<Option<String>>,
    dl_cancel: AtomicBool,
}

impl Default for WhisperState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            session_lock: tokio::sync::Mutex::new(()),
            generation: AtomicU64::new(0),
            exiting: AtomicBool::new(false),
            port: Mutex::new(None),
            running_model: Mutex::new(None),
            dl_lock: tokio::sync::Mutex::new(()),
            rt_lock: tokio::sync::Mutex::new(()),
            dl_model: Mutex::new(None),
            dl_cancel: AtomicBool::new(false),
        }
    }
}

impl Drop for WhisperState {
    fn drop(&mut self) {
        stop_child(&self.child);
    }
}

fn stop_child(slot: &Mutex<Option<WhisperProcess>>) {
    if let Ok(mut guard) = slot.lock() {
        if let Some(mut child) = guard.take() {
            child.kill();
        }
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, event: DownloadEvent) {
    let _ = app.emit_all("whisper-download", event);
}

fn model_spec(id: &str) -> Result<&'static ModelSpec, String> {
    MODELS
        .iter()
        .find(|model| model.id == id)
        .ok_or_else(|| format!("Unknown Whisper model: {id}"))
}

fn can_write_dir(dir: &Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".write_test");
    if std::fs::write(&probe, b"ok").is_err() {
        return false;
    }
    let _ = std::fs::remove_file(probe);
    true
}

fn fallback_root() -> PathBuf {
    if cfg!(windows) {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("com.cursescaptions.app");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        if cfg!(target_os = "macos") {
            return PathBuf::from(home).join("Library/Application Support/com.cursescaptions.app");
        }
        return PathBuf::from(home).join(".local/share/com.cursescaptions.app");
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn resolve_models_dir() -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let dir = parent.join("Models");
            if can_write_dir(&dir) {
                return Ok(dir);
            }
        }
    }
    let dir = fallback_root().join("Models");
    std::fs::create_dir_all(&dir).map_err(|err| format!("Could not create Models folder: {err}"))?;
    Ok(dir)
}

fn ggml_magic_ok(path: &Path) -> bool {
    let mut file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return false,
    };
    let mut buf = [0u8; 4];
    std::io::Read::read_exact(&mut file, &mut buf).is_ok() && buf == *b"lmgg"
}

fn model_file_ready(path: &Path, expected: u64) -> bool {
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    let minimum = expected.saturating_mul(95) / 100;
    meta.len() + 4096 >= minimum && ggml_magic_ok(path)
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(10))
        .user_agent("curses/0.0.23")
        .build()
        .map_err(|err| err.to_string())
}

async fn download_to<R: Runtime>(
    app: &AppHandle<R>,
    model: &str,
    phase: &str,
    url: &str,
    destination: &Path,
    expected: u64,
    label: &str,
    cancel: Option<&AtomicBool>,
) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let partial = destination.with_extension(format!(
        "{}.partial",
        destination.extension().and_then(|ext| ext.to_str()).unwrap_or("bin")
    ));
    let client = http_client()?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|err| format!("Download failed: {err}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed ({})", response.status()));
    }
    let total = response.content_length().unwrap_or(expected);
    emit(app, DownloadEvent {
        model: model.to_string(),
        phase: phase.to_string(),
        received: 0,
        total,
        done: false,
        message: format!("Downloading {label}"),
    });
    let mut file = tokio::fs::File::create(&partial)
        .await
        .map_err(|err| err.to_string())?;
    let mut stream = response.bytes_stream();
    let mut received: u64 = 0;
    let mut last = Instant::now() - Duration::from_secs(1);
    while let Some(chunk) = stream.next().await {
        if cancel.map(|flag| flag.load(Ordering::SeqCst)).unwrap_or(false) {
            drop(file);
            let _ = tokio::fs::remove_file(&partial).await;
            return Err("Download cancelled".into());
        }
        let chunk = chunk.map_err(|err| err.to_string())?;
        file.write_all(&chunk).await.map_err(|err| err.to_string())?;
        received += chunk.len() as u64;
        if last.elapsed() > Duration::from_millis(250) {
            last = Instant::now();
            emit(app, DownloadEvent {
                model: model.to_string(),
                phase: phase.to_string(),
                received,
                total,
                done: false,
                message: format!("Downloading {label}"),
            });
        }
    }
    file.flush().await.map_err(|err| err.to_string())?;
    drop(file);
    let _ = std::fs::remove_file(destination);
    std::fs::rename(&partial, destination).map_err(|err| err.to_string())?;
    emit(app, DownloadEvent {
        model: model.to_string(),
        phase: phase.to_string(),
        received: total,
        total,
        done: true,
        message: format!("{label} ready"),
    });
    Ok(())
}

fn find_named(dir: &Path, name: &str) -> Option<PathBuf> {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = std::fs::read_dir(&current).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.file_name().and_then(|value| value.to_str()) == Some(name) {
                return Some(path);
            }
        }
    }
    None
}

fn server_name() -> &'static str {
    if cfg!(windows) { "whisper-server.exe" } else { "whisper-server" }
}

fn server_on_path() -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(server_name());
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn runtime_archive(backend: Backend) -> Option<(&'static str, &'static str)> {
    if cfg!(all(windows, target_arch = "x86_64")) {
        if backend == Backend::Cuda {
            Some(("https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-win-cuda-12.4.0-x64.zip", "zip"))
        } else {
            Some(("https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip", "zip"))
        }
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some(("https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-ubuntu-x64.tar.gz", "tar.gz"))
    } else {
        None
    }
}

fn unzip_to(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|err| err.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|err| format!("Could not read Whisper runtime: {err}"))?;
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|err| err.to_string())?;
        let Some(name) = entry.enclosed_name() else { continue; };
        let out = dest.join(name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(|err| err.to_string())?;
        } else {
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            let mut outfile = std::fs::File::create(&out).map_err(|err| err.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn untar_gz(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|err| err.to_string())?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(decoder);
    tar.unpack(dest).map_err(|err| format!("Could not unpack Whisper runtime: {err}"))
}

#[cfg(unix)]
fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(path) {
        let mut permissions = meta.permissions();
        permissions.set_mode(permissions.mode() | 0o755);
        let _ = std::fs::set_permissions(path, permissions);
    }
}

impl WhisperState {
    async fn ensure_runtime<R: Runtime>(&self, app: &AppHandle<R>, backend: Backend) -> Result<PathBuf, String> {
        let _guard = self.rt_lock.lock().await;
        let root = resolve_models_dir()?.join("runtime").join(RUNTIME_TAG).join(backend.key());
        std::fs::create_dir_all(&root).map_err(|err| err.to_string())?;
        if let Some(existing) = find_named(&root.join("files"), server_name()).filter(|_| root.join("ready").is_file()) {
            #[cfg(unix)]
            make_executable(&existing);
            return Ok(existing);
        }
        let Some((url, kind)) = runtime_archive(backend) else {
            return server_on_path().ok_or_else(|| {
                "Whisper runtime is available automatically on 64-bit Windows and Linux. On this system, install whisper-server and make sure it is on PATH.".into()
            });
        };
        let archive = root.join(if kind == "zip" { "runtime.zip" } else { "runtime.tar.gz" });
        let expected = if backend == Backend::Cuda { 684_913_404 } else { 10_000_000 };
        let label = if backend == Backend::Cuda { "Whisper NVIDIA CUDA runtime" } else { "Whisper CPU runtime" };
        download_to(app, "runtime", "runtime", url, &archive, expected, label, Some(&self.exiting)).await?;
        let unpacked = root.join("files");
        if unpacked.exists() { std::fs::remove_dir_all(&unpacked).map_err(|err| err.to_string())?; }
        std::fs::create_dir_all(&unpacked).map_err(|err| err.to_string())?;
        if kind == "zip" {
            unzip_to(&archive, &unpacked)?;
        } else {
            untar_gz(&archive, &unpacked)?;
        }
        let _ = std::fs::remove_file(&archive);
        let binary = find_named(&unpacked, server_name()).ok_or_else(|| "Whisper runtime did not include whisper-server".to_string())?;
        #[cfg(unix)]
        make_executable(&binary);
        std::fs::write(root.join("ready"), RUNTIME_TAG).map_err(|err| err.to_string())?;
        Ok(binary)
    }

    async fn ensure_model<R: Runtime>(&self, app: &AppHandle<R>, model: &str) -> Result<PathBuf, String> {
        if self.exiting.load(Ordering::SeqCst) { return Err("Curses is closing".into()); }
        let spec = model_spec(model)?;
        let path = resolve_models_dir()?.join(spec.file);
        if model_file_ready(&path, spec.bytes) {
            return Ok(path);
        }

        {
            let mut current = self.dl_model.lock().map_err(|err| err.to_string())?;
            if current.as_deref() != Some(model) {
                self.dl_cancel.store(true, Ordering::SeqCst);
                *current = Some(model.to_string());
            }
        }

        let _guard = self.dl_lock.lock().await;
        if model_file_ready(&path, spec.bytes) {
            return Ok(path);
        }
        if self.dl_model.lock().map_err(|err| err.to_string())?.as_deref() != Some(model) {
            return Err("Download cancelled".into());
        }
        if self.exiting.load(Ordering::SeqCst) { return Err("Curses is closing".into()); }
        self.dl_cancel.store(false, Ordering::SeqCst);
        let url = format!(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}?download=true",
            spec.file
        );
        let result = download_to(
            app,
            spec.id,
            "model",
            &url,
            &path,
            spec.bytes,
            spec.id,
            Some(&self.dl_cancel),
        ).await;
        if self.dl_model.lock().ok().and_then(|mut current| {
            if current.as_deref() == Some(model) {
                *current = None;
                Some(())
            } else {
                None
            }
        }).is_some() {}
        if result.is_ok() && !model_file_ready(&path, spec.bytes) {
            let _ = std::fs::remove_file(&path);
            return Err("Downloaded file is not a Whisper model".into());
        }
        result.map(|_| path)
    }
}

fn pick_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|err| err.to_string())?;
    let port = listener.local_addr().map_err(|err| err.to_string())?.port();
    Ok(port)
}

fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

fn start_server(binary: &Path, model: &Path, port: u16, backend: Backend, device: u32) -> Result<WhisperProcess, String> {
    let folder = binary.parent().ok_or_else(|| "Missing Whisper runtime folder".to_string())?;
    let public = folder.join("public");
    std::fs::create_dir_all(&public).ok();
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(2, 8);
    let mut cmd = Command::new(binary);
    cmd.current_dir(folder)
        .arg("--host").arg("127.0.0.1")
        .arg("--port").arg(port.to_string())
        .arg("--public").arg(&public)
        .arg("-m").arg(model)
        .arg("-l").arg("auto")
        .arg("-t").arg(threads.to_string())
        .arg("-nt")
        .args(backend.args(device))
        .arg("--suppress-nst")
        .stdin(Stdio::null());
    if let Ok(log_path) = resolve_models_dir().map(|dir| dir.join("whisper-server.log")) {
        if let Ok(log) = std::fs::File::create(&log_path) {
            if let Ok(err) = log.try_clone() {
                cmd.stdout(Stdio::from(log)).stderr(Stdio::from(err));
            }
        }
    }
    hide_console(&mut cmd);
    WhisperProcess::spawn(&mut cmd)
}

async fn health_ok(port: u16) -> bool {
    let Ok(client) = reqwest::Client::builder().timeout(Duration::from_secs(2)).build() else {
        return false;
    };
    let Ok(response) = client.get(format!("http://127.0.0.1:{port}/health")).send().await else {
        return false;
    };
    response.text().await.map(|text| text.contains("ok")).unwrap_or(false)
}

async fn wait_healthy(child: &Mutex<Option<WhisperProcess>>, port: u16) -> Result<(), String> {
    for _ in 0..400 {
        {
            let mut guard = child.lock().map_err(|err| err.to_string())?;
            if let Some(process) = guard.as_mut() {
                if let Some(status) = process.try_wait().map_err(|err| err.to_string())? {
                    return Err(format!("Whisper exited ({status}). See whisper-server.log in the Models folder."));
                }
            } else {
                return Err("Whisper process is not running".into());
            }
        }
        if health_ok(port).await {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    Err("Whisper took too long to load the model".into())
}

fn is_non_speech_caption(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }
    if (trimmed.starts_with('(') && trimmed.ends_with(')')) || (trimmed.starts_with('[') && trimmed.ends_with(']')) {
        return true;
    }
    let lower = trimmed.trim_matches(|ch: char| !ch.is_alphanumeric()).to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "thanks for watching"
            | "thank you for watching"
            | "thanks for listening"
            | "please subscribe"
            | "subtitles by the amara.org community"
    )
}

fn clean_transcript(value: &serde_json::Value) -> String {
    if let Some(segments) = value.get("segments").and_then(|item| item.as_array()) {
        let mut parts = Vec::new();
        for segment in segments {
            let no_speech = segment.get("no_speech_prob").and_then(|item| item.as_f64()).unwrap_or(0.0);
            let text = segment.get("text").and_then(|item| item.as_str()).unwrap_or("").trim();
            if text.is_empty() || no_speech >= 0.75 || is_non_speech_caption(text) {
                continue;
            }
            parts.push(text.to_string());
        }
        return parts.join(" ").split_whitespace().collect::<Vec<_>>().join(" ");
    }
    let text = value.get("text").and_then(|item| item.as_str()).unwrap_or("").trim();
    if is_non_speech_caption(text) {
        String::new()
    } else {
        text.to_string()
    }
}

#[command]
fn models_dir() -> Result<String, String> {
    resolve_models_dir().map(|path| path.to_string_lossy().to_string())
}

#[command]
async fn download_model<R: Runtime>(model: String, app: AppHandle<R>, state: State<'_, WhisperState>) -> Result<(), String> {
    state.ensure_model(&app, &model).await?;
    Ok(())
}

#[derive(Clone, Serialize)]
struct SessionInfo {
    port: u16,
    session_id: u64,
    backend: String,
    device: String,
}

#[command]
async fn ensure_session<R: Runtime>(
    model: String, acceleration: Option<String>, gpu_device: Option<u32>,
    app: AppHandle<R>, state: State<'_, WhisperState>,
) -> Result<SessionInfo, String> {
    let _session_guard = state.session_lock.lock().await;
    if state.exiting.load(Ordering::SeqCst) { return Err("Curses is closing".into()); }
    let session_id = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    stop_child(&state.child);
    *state.port.lock().map_err(|e| e.to_string())? = None;
    *state.running_model.lock().map_err(|e| e.to_string())? = None;
    let backend = Backend::select(acceleration.as_deref().unwrap_or("auto"), cfg!(all(windows, target_arch = "x86_64")))?;
    let gpu_device = gpu_device.unwrap_or(0);
    if gpu_device > 31 { return Err("GPU device ID must be between 0 and 31".into()); }
    let binary = state.ensure_runtime(&app, backend).await?;
    let model_path = state.ensure_model(&app, &model).await?;
    let port = pick_port()?;
    {
        // Exit cleanup takes the same lock, so it cannot miss a newly spawned child.
        let mut slot = state.child.lock().map_err(|e| e.to_string())?;
        if state.exiting.load(Ordering::SeqCst) || state.generation.load(Ordering::SeqCst) != session_id {
            return Err("Whisper startup cancelled".into());
        }
        *slot = Some(start_server(&binary, &model_path, port, backend, gpu_device)?);
    }
    if let Err(err) = wait_healthy(&state.child, port).await {
        stop_child(&state.child);
        return Err(format!("{err} If using CUDA, update your NVIDIA driver or explicitly select CPU in Speech to Text."));
    }
    let device = if backend == Backend::Cuda {
        let log = std::fs::read_to_string(resolve_models_dir()?.join("whisper-server.log")).unwrap_or_default();
        match verified_cuda_device(&log) {
            Some(device) => device,
            None => {
                stop_child(&state.child);
                return Err("CUDA was requested but GPU model allocation could not be verified. Whisper was stopped instead of silently running on CPU. Check whisper-server.log, update your NVIDIA driver, or select CPU explicitly.".into());
            }
        }
    } else { "CPU".into() };
    if state.exiting.load(Ordering::SeqCst) || state.generation.load(Ordering::SeqCst) != session_id {
        stop_child(&state.child);
        return Err("Whisper startup cancelled".into());
    }
    *state.port.lock().map_err(|err| err.to_string())? = Some(port);
    *state.running_model.lock().map_err(|err| err.to_string())? = Some(model);
    Ok(SessionInfo { port, session_id, backend: backend.key().into(), device })
}

#[command]
fn stop_session(session_id: u64, state: State<'_, WhisperState>) {
    // A delayed stop from the old microphone must not kill the replacement session.
    let mut child = match state.child.lock() { Ok(child) => child, Err(_) => return };
    if state.generation.load(Ordering::SeqCst) != session_id { return; }
    state.generation.fetch_add(1, Ordering::SeqCst);
    if let Some(mut process) = child.take() { process.kill(); }
    if let Ok(mut port) = state.port.lock() { *port = None; }
    if let Ok(mut running) = state.running_model.lock() { *running = None; }
}

pub fn shutdown<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<WhisperState>();
    state.exiting.store(true, Ordering::SeqCst);
    state.dl_cancel.store(true, Ordering::SeqCst);
    state.generation.fetch_add(1, Ordering::SeqCst);
    stop_child(&state.child);
}

#[command]
async fn transcribe(
    wav_base64: String,
    language: String,
    translate: bool,
    session_id: u64,
    state: State<'_, WhisperState>,
) -> Result<String, String> {
    if state.generation.load(Ordering::SeqCst) != session_id { return Err("Whisper session was replaced".into()); }
    let port = state.port.lock().map_err(|err| err.to_string())?.clone().ok_or_else(|| "Whisper is not running".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(wav_base64.trim())
        .map_err(|err| format!("Bad audio payload: {err}"))?;
    let file = reqwest::multipart::Part::bytes(bytes)
        .file_name("speech.wav")
        .mime_str("audio/wav")
        .map_err(|err| err.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("file", file)
        .text("response_format", "verbose_json")
        .text("temperature", "0")
        .text("temperature_inc", "0")
        .text("language", if language.is_empty() { "auto".to_string() } else { language })
        .text("translate", if translate { "true" } else { "false" })
        .text("suppress_nst", "true")
        .text("no_speech_thold", "0.6");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .post(format!("http://127.0.0.1:{port}/inference"))
        .multipart(form)
        .send()
        .await
        .map_err(|err| format!("Whisper request failed: {err}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Whisper error {status}: {body}"));
    }
    let value: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;
    if translate && value.get("task").and_then(|task| task.as_str()) != Some("translate") {
        return Err("Whisper returned transcription instead of translation. Restart Speech to Text with a multilingual model (not .en or Turbo).".into());
    }
    Ok(clean_transcript(&value))
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("whisper")
        .invoke_handler(tauri::generate_handler![
            models_dir,
            download_model,
            ensure_session,
            stop_session,
            transcribe
        ])
        .setup(|app| {
            app.manage(WhisperState::default());
            Ok(())
        })
        .on_event(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) { shutdown(app); }
        })
        .build()
}
