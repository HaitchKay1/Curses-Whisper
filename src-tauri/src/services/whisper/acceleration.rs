// Pure runtime policy, also exercised with rustc --test independently of Tauri.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend { Cpu, Cuda }

impl Backend {
    pub fn select(requested: &str, windows_x64: bool) -> Result<Self, String> {
        match requested {
            "cpu" => Ok(Self::Cpu),
            "auto" if !windows_x64 => Ok(Self::Cpu),
            "auto" | "cuda" if windows_x64 => Ok(Self::Cuda),
            "cuda" => Err("Automatic CUDA runtime installation requires 64-bit Windows. Select CPU on this platform.".into()),
            _ => Err("Unknown Whisper processing device".into()),
        }
    }
    pub fn key(self) -> &'static str {
        match self { Self::Cpu => "cpu", Self::Cuda => "cuda-12.4" }
    }
    pub fn args(self, device: u32) -> Vec<String> {
        match self {
            Self::Cpu => vec!["--no-gpu".into()],
            Self::Cuda => vec!["--device".into(), device.to_string(), "--flash-attn".into()],
        }
    }
}

pub fn verified_cuda_device(log: &str) -> Option<String> {
    // Pinned whisper.cpp b5454 reports the selected backend and model allocation.
    // Merely finding a CUDA DLL/device is not proof that the model uses it.
    for line in log.lines() {
        if let Some(rest) = line.split("whisper_backend_init_gpu: using ").nth(1) {
            if let Some(device) = rest.strip_suffix(" backend") {
                if device.starts_with("CUDA") && !device.contains(' ') &&
                    log.lines().any(|l| l.contains("whisper_model_load:") && l.contains(device) && l.contains("total size =")) &&
                    !log.contains(&format!("failed to initialize {device} backend")) {
                    return Some(device.to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn windows_defaults_to_cuda_without_silent_cpu_fallback() {
        assert_eq!(Backend::select("auto", true).unwrap(), Backend::Cuda);
        assert_eq!(Backend::select("cpu", true).unwrap(), Backend::Cpu);
        assert!(Backend::select("invalid", true).is_err());
        assert!(Backend::select("cuda", false).is_err());
        assert_eq!(Backend::select("auto", false).unwrap(), Backend::Cpu);
    }
    #[test] fn cuda_never_disables_gpu() {
        assert_eq!(Backend::Cuda.args(2), vec!["--device", "2", "--flash-attn"]);
        assert_eq!(Backend::Cpu.args(0), vec!["--no-gpu"]);
        assert_ne!(Backend::Cpu.key(), Backend::Cuda.key());
    }
    #[test] fn require_selected_cuda_backend_and_model_allocation() {
        let log = "whisper_model_load:        CUDA0 total size = 487.60 MB\nwhisper_backend_init_gpu: using CUDA0 backend\n";
        assert_eq!(verified_cuda_device(log).as_deref(), Some("CUDA0"));
        assert!(verified_cuda_device("ggml_cuda_init: found 1 CUDA devices\nwhisper_backend_init_gpu: no GPU found").is_none());
        assert!(verified_cuda_device("whisper_backend_init_gpu: using CUDA0 backend").is_none());
        assert!(verified_cuda_device(&format!("{log}whisper_backend_init_gpu: failed to initialize CUDA0 backend")).is_none());
    }
}
