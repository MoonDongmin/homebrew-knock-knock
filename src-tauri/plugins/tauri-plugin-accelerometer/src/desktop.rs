use crate::iokit_hid::AccelSample;
use serde::Serialize;
use std::io::Read;
use std::os::unix::net::UnixListener;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

/// Event payload emitted to the frontend at ~100Hz.
#[derive(Debug, Clone, Serialize)]
pub struct AccelerometerEvent {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub timestamp: u64,
}

/// Calibration result — average baseline vector over 1 second.
#[derive(Debug, Clone, Serialize)]
pub struct CalibrationResult {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub samples: u32,
}

/// Thread-safe state for the accelerometer stream.
///
/// The privileged helper is launched once per session and kept alive.
/// `start` / `stop` toggle event emission without restarting the helper.
pub struct AccelerometerState {
    inner: Mutex<Option<HelperState>>,
}

struct HelperState {
    /// Whether the reader thread is alive (false = helper disconnected/crashed).
    alive: Arc<AtomicBool>,
    /// Whether to emit accelerometer events to the frontend.
    emitting: Arc<AtomicBool>,
    /// Whether to collect calibration samples.
    calibrating: Arc<AtomicBool>,
    /// Shared buffer for calibration sample collection.
    calibration_samples: Arc<Mutex<Vec<AccelSample>>>,
    /// Reader thread — reads from Unix socket, emits events / collects samples.
    reader_thread: Option<JoinHandle<()>>,
    /// osascript thread — blocks until the helper process exits.
    osascript_thread: Option<JoinHandle<Result<(), String>>>,
    /// Socket path for cleanup.
    socket_path: PathBuf,
}

impl Default for AccelerometerState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl AccelerometerState {
    /// Resolve the helper binary path (same directory as the main executable).
    fn resolve_helper_path() -> Result<PathBuf, String> {
        let exe = std::env::current_exe().map_err(|e| format!("Failed to resolve exe: {e}"))?;
        let dir = exe
            .parent()
            .ok_or_else(|| "Failed to get exe parent dir".to_string())?;
        let helper = dir.join("knockknock-helper");
        if helper.exists() {
            return Ok(helper);
        }
        Err(format!(
            "Helper binary not found at {}",
            helper.display()
        ))
    }

    /// Create a Unix domain socket for helper communication.
    fn create_socket() -> Result<(UnixListener, PathBuf), String> {
        let path = PathBuf::from(format!(
            "/tmp/knockknock-accel-{}.sock",
            std::process::id()
        ));
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
        let listener =
            UnixListener::bind(&path).map_err(|e| format!("Failed to bind socket: {e}"))?;
        Ok((listener, path))
    }

    /// Launch the helper via osascript (shows macOS native password dialog).
    fn launch_helper(
        helper_path: &PathBuf,
        socket_path: &PathBuf,
    ) -> JoinHandle<Result<(), String>> {
        let helper_str = helper_path.display().to_string();
        let socket_str = socket_path.display().to_string();

        thread::Builder::new()
            .name("osascript-launcher".into())
            .spawn(move || {
                let script = format!(
                    "do shell script \"'{}' '{}'\" with administrator privileges",
                    helper_str, socket_str
                );
                eprintln!("[Accel] Launching helper via osascript...");
                let output = Command::new("osascript")
                    .args(["-e", &script])
                    .output()
                    .map_err(|e| format!("Failed to run osascript: {e}"))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if stderr.contains("User canceled") || stderr.contains("-128") {
                        return Err("User canceled administrator authorization".into());
                    }
                    return Err(format!("osascript failed: {stderr}"));
                }
                Ok(())
            })
            .expect("Failed to spawn osascript thread")
    }

    /// Wait for helper to connect, with timeout and cancellation.
    fn accept_with_timeout(
        listener: &UnixListener,
        alive: &AtomicBool,
        timeout: Duration,
    ) -> Result<std::os::unix::net::UnixStream, String> {
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {e}"))?;

        let deadline = Instant::now() + timeout;
        loop {
            if !alive.load(Ordering::Relaxed) {
                return Err("Canceled".into());
            }
            if Instant::now() > deadline {
                return Err(
                    "Timed out waiting for helper. Was the password dialog canceled?".into(),
                );
            }
            match listener.accept() {
                Ok((stream, _)) => {
                    stream
                        .set_nonblocking(false)
                        .map_err(|e| format!("Failed to set blocking: {e}"))?;
                    return Ok(stream);
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(100));
                }
                Err(e) => return Err(format!("Socket accept failed: {e}")),
            }
        }
    }

    /// Ensure the privileged helper is running. Launches it on first call;
    /// subsequent calls are no-ops unless the helper crashed.
    fn ensure_helper<R: Runtime>(&self, app: AppHandle<R>) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;

        // Check if existing helper is still alive
        if let Some(ref state) = *guard {
            if state.alive.load(Ordering::Relaxed) {
                return Ok(());
            }
            // Helper died — clean up before relaunching
            eprintln!("[Accel] Helper disconnected, relaunching...");
        }

        // Clean up stale state (if any)
        if let Some(old) = guard.take() {
            let _ = std::fs::remove_file(&old.socket_path);
            if let Some(t) = old.reader_thread {
                let _ = t.join();
            }
            if let Some(t) = old.osascript_thread {
                let _ = t.join();
            }
        }

        let helper_path = Self::resolve_helper_path()?;
        let (listener, socket_path) = Self::create_socket()?;

        let alive = Arc::new(AtomicBool::new(true));
        let emitting = Arc::new(AtomicBool::new(false));
        let calibrating = Arc::new(AtomicBool::new(false));
        let calibration_samples: Arc<Mutex<Vec<AccelSample>>> =
            Arc::new(Mutex::new(Vec::with_capacity(200)));

        let osascript_thread = Self::launch_helper(&helper_path, &socket_path);

        // Spawn reader thread
        let alive_clone = alive.clone();
        let emitting_clone = emitting.clone();
        let calibrating_clone = calibrating.clone();
        let samples_clone = calibration_samples.clone();
        let socket_path_clone = socket_path.clone();
        let start_time = Instant::now();

        let reader_thread = thread::Builder::new()
            .name("accel-reader".into())
            .spawn(move || {
                eprintln!("[Accel] Waiting for helper to connect...");
                let stream = match Self::accept_with_timeout(
                    &listener,
                    &alive_clone,
                    Duration::from_secs(30),
                ) {
                    Ok(s) => {
                        eprintln!("[Accel] Helper connected");
                        s
                    }
                    Err(e) => {
                        eprintln!("[Accel] {e}");
                        let _ = app.emit("accelerometer://error", &e);
                        alive_clone.store(false, Ordering::Relaxed);
                        let _ = std::fs::remove_file(&socket_path_clone);
                        return;
                    }
                };

                stream
                    .set_read_timeout(Some(Duration::from_millis(500)))
                    .ok();

                let mut buf = [0u8; 24];
                let mut count: u64 = 0;

                loop {
                    if !alive_clone.load(Ordering::Relaxed) {
                        break;
                    }

                    match (&stream).read_exact(&mut buf) {
                        Ok(()) => {
                            count += 1;
                            let x = f64::from_le_bytes(buf[0..8].try_into().unwrap());
                            let y = f64::from_le_bytes(buf[8..16].try_into().unwrap());
                            let z = f64::from_le_bytes(buf[16..24].try_into().unwrap());

                            if count == 1 {
                                eprintln!(
                                    "[Accel] First sample: x={x:.4} y={y:.4} z={z:.4}"
                                );
                            }
                            if count % 500 == 0 {
                                eprintln!("[Accel] Received {count} samples");
                            }

                            // Collect calibration samples
                            if calibrating_clone.load(Ordering::Relaxed) {
                                if let Ok(mut samples) = samples_clone.lock() {
                                    samples.push(AccelSample { x, y, z });
                                }
                            }

                            // Emit events when monitoring is active
                            if emitting_clone.load(Ordering::Relaxed) {
                                let event = AccelerometerEvent {
                                    x,
                                    y,
                                    z,
                                    timestamp: start_time.elapsed().as_micros() as u64,
                                };
                                let _ = app.emit("accelerometer://data", &event);
                            }
                        }
                        Err(ref e)
                            if e.kind() == std::io::ErrorKind::TimedOut
                                || e.kind() == std::io::ErrorKind::WouldBlock =>
                        {
                            continue;
                        }
                        Err(_) => {
                            eprintln!("[Accel] Helper disconnected after {count} samples");
                            break;
                        }
                    }
                }

                alive_clone.store(false, Ordering::Relaxed);
                let _ = std::fs::remove_file(&socket_path_clone);
            })
            .map_err(|e| format!("Failed to spawn reader thread: {e}"))?;

        *guard = Some(HelperState {
            alive,
            emitting,
            calibrating,
            calibration_samples,
            reader_thread: Some(reader_thread),
            osascript_thread: Some(osascript_thread),
            socket_path,
        });

        Ok(())
    }

    /// Start emitting accelerometer events. Launches helper on first call.
    pub fn start<R: Runtime>(&self, app: AppHandle<R>) -> Result<(), String> {
        self.ensure_helper(app)?;

        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(ref state) = *guard {
            state.emitting.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    /// Stop emitting accelerometer events. Helper stays alive for reuse.
    pub fn stop(&self) -> Result<(), String> {
        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(ref state) = *guard {
            state.emitting.store(false, Ordering::Relaxed);
        }
        Ok(())
    }

    /// Collect samples for 1 second and return the average baseline.
    /// Reuses the existing helper connection (no extra password prompt).
    pub async fn calibrate<R: Runtime>(
        &self,
        app: AppHandle<R>,
    ) -> Result<CalibrationResult, String> {
        self.ensure_helper(app)?;

        let (calibrating, calibration_samples) = {
            let guard = self.inner.lock().map_err(|e| e.to_string())?;
            let state = guard.as_ref().ok_or("Helper not running")?;

            // Pause event emission during calibration
            state.emitting.store(false, Ordering::Relaxed);

            (state.calibrating.clone(), state.calibration_samples.clone())
        };

        // Clear old samples and start collecting
        if let Ok(mut samples) = calibration_samples.lock() {
            samples.clear();
        }
        calibrating.store(true, Ordering::Relaxed);

        // Collect for 1 second
        thread::sleep(Duration::from_secs(1));

        calibrating.store(false, Ordering::Relaxed);

        // Compute average
        let guard = calibration_samples.lock().map_err(|e| e.to_string())?;

        if guard.is_empty() {
            return Err(
                "No samples collected during calibration. Administrator privileges required."
                    .into(),
            );
        }

        let count = guard.len() as f64;
        let sum = guard.iter().fold((0.0, 0.0, 0.0), |acc, s| {
            (acc.0 + s.x, acc.1 + s.y, acc.2 + s.z)
        });

        eprintln!("[Calibration] Collected {} samples", guard.len());

        Ok(CalibrationResult {
            x: sum.0 / count,
            y: sum.1 / count,
            z: sum.2 / count,
            samples: guard.len() as u32,
        })
    }
}
