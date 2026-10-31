#[cfg(all(test, unix))]
use std::path::Path;
use std::process::{Child, Command, ExitStatus};

// Own only the server launched by this Curses instance. Never kill by image name.
pub struct WhisperProcess {
    child: Child,
    #[cfg(windows)]
    _job: windows_job::Job,
}

impl WhisperProcess {
    pub fn spawn(command: &mut Command) -> Result<Self, String> {
        #[cfg(windows)]
        let job = windows_job::Job::new()?;
        #[allow(unused_mut)]
        let mut child = command.spawn().map_err(|e| format!("Could not start Whisper: {e}"))?;
        #[cfg(windows)]
        if let Err(error) = job.assign(&child) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        Ok(Self { child, #[cfg(windows)] _job: job })
    }
    pub fn kill(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); }
    pub fn try_wait(&mut self) -> std::io::Result<Option<ExitStatus>> { self.child.try_wait() }
}
impl Drop for WhisperProcess { fn drop(&mut self) { self.kill(); } }

#[cfg(windows)]
mod windows_job {
    use std::{mem::size_of, os::windows::io::AsRawHandle, process::Child};
    use windows::{core::PCWSTR, Win32::{Foundation::{CloseHandle, HANDLE}, System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    }}};

    pub struct Job(HANDLE);
    impl Job {
        pub fn new() -> Result<Self, String> {
            let handle = unsafe { CreateJobObjectW(None, PCWSTR::null()) }
                .map_err(|e| format!("Could not create Whisper process job: {e}"))?;
            let job = Self(handle);
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = unsafe { SetInformationJobObject(job.0, JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _, size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32) };
            if !ok.as_bool() { return Err(format!("Could not configure Whisper process job: {}", std::io::Error::last_os_error())); }
            Ok(job)
        }
        pub fn assign(&self, child: &Child) -> Result<(), String> {
            if unsafe { AssignProcessToJobObject(self.0, HANDLE(child.as_raw_handle() as isize)) }.as_bool() { Ok(()) }
            else { Err(format!("Could not attach Whisper to Curses: {}", std::io::Error::last_os_error())) }
        }
    }
    impl Drop for Job { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    #[test]
    fn dropping_owner_terminates_child() {
        #[cfg(unix)]
        {
            let mut command = Command::new("sleep");
            command.arg("30");
            let process = WhisperProcess::spawn(&mut command).unwrap();
            let pid = process.child.id();
            drop(process);
            assert!(!Path::new(&format!("/proc/{pid}")).exists());
        }
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::{thread, time::{Duration, Instant}};
    #[test]
    fn closing_job_kills_the_owned_process() {
        let mut child = Command::new("cmd.exe").args(["/C", "ping -n 30 127.0.0.1 > nul"]).spawn().unwrap();
        let job = windows_job::Job::new().unwrap();
        job.assign(&child).unwrap();
        drop(job); // Same OS cleanup as losing the Curses handle on process termination.
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if child.try_wait().unwrap().is_some() { return; }
            if Instant::now() >= deadline { let _ = child.kill(); let _ = child.wait(); panic!("Whisper job did not terminate child"); }
            thread::sleep(Duration::from_millis(20));
        }
    }
}
