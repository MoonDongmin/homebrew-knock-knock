use crate::iokit_hid::AccelSample;
use serde::Serialize;
use std::io::Read;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};

/// LaunchDaemon identity — must match the Label in the plist.
const DAEMON_LABEL: &str = "com.knockknock.helper";
const DAEMON_PLIST_PATH: &str = "/Library/LaunchDaemons/com.knockknock.helper.plist";
/// Well-known socket the daemon binds to; the app connects to it on every start.
const DAEMON_SOCKET_PATH: &str = "/var/run/com.knockknock.helper.sock";

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
/// Production builds (installed in `/Applications/`) connect to a persistent
/// LaunchDaemon — first launch prompts for the admin password once, installs
/// the plist, and every subsequent launch skips the prompt. Dev builds fall
/// back to launching the helper per-session via `osascript`.
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
    /// osascript thread (legacy mode only) — blocks until the helper process exits.
    osascript_thread: Option<JoinHandle<Result<(), String>>>,
    /// Legacy per-PID socket path we own and must remove on cleanup.
    /// `None` in daemon mode (the daemon owns its own socket).
    legacy_socket_path: Option<PathBuf>,
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
        Err(format!("Helper binary not found at {}", helper.display()))
    }

    /// True when the app is running from a production install location where the
    /// LaunchDaemon flow is appropriate. Dev builds under `target/` fall back to
    /// the legacy per-session osascript flow.
    fn is_production_install(helper_path: &Path) -> bool {
        helper_path.starts_with("/Applications/")
    }

    /// Render the LaunchDaemon plist with the current helper path baked in.
    fn daemon_plist(helper_path: &Path) -> String {
        let helper_str = helper_path.display().to_string();
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{DAEMON_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{helper_str}</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardErrorPath</key>
    <string>/tmp/knockknock-helper.err.log</string>
    <key>StandardOutPath</key>
    <string>/tmp/knockknock-helper.out.log</string>
</dict>
</plist>
"#
        )
    }

    /// Check whether the installed LaunchDaemon plist matches the current helper
    /// path. Returns false if the plist is missing or points somewhere stale
    /// (e.g. the user reinstalled to a different location).
    fn daemon_is_current(helper_path: &Path) -> bool {
        let contents = match std::fs::read_to_string(DAEMON_PLIST_PATH) {
            Ok(s) => s,
            Err(_) => return false,
        };
        contents.contains(&helper_path.display().to_string())
    }

    /// Install or reinstall the LaunchDaemon. Triggers a single `osascript`
    /// admin-privileges prompt — the user sees the native macOS password dialog
    /// once, after which the daemon persists across reboots.
    fn install_daemon(helper_path: &Path) -> Result<(), String> {
        let plist_contents = Self::daemon_plist(helper_path);

        let tmp_plist = std::env::temp_dir().join(format!("{DAEMON_LABEL}.plist"));
        std::fs::write(&tmp_plist, plist_contents)
            .map_err(|e| format!("Failed to write temp plist: {e}"))?;
        let tmp_str = tmp_plist.display().to_string();

        // Bootout ignores errors (first install has nothing to unload). Then
        // install the fresh plist with root:wheel 0644 and bootstrap it.
        let shell_cmd = format!(
            "/bin/launchctl bootout system {DAEMON_PLIST_PATH} 2>/dev/null; \
             /bin/cp '{tmp_str}' '{DAEMON_PLIST_PATH}' && \
             /usr/sbin/chown root:wheel '{DAEMON_PLIST_PATH}' && \
             /bin/chmod 644 '{DAEMON_PLIST_PATH}' && \
             /bin/launchctl bootstrap system '{DAEMON_PLIST_PATH}'"
        );

        let escaped = shell_cmd.replace('\\', "\\\\").replace('"', "\\\"");
        let apple_script = format!("do shell script \"{escaped}\" with administrator privileges");

        eprintln!("[Accel] Installing LaunchDaemon (password prompt)...");
        let output = Command::new("osascript")
            .args(["-e", &apple_script])
            .output()
            .map_err(|e| format!("osascript failed: {e}"))?;

        let _ = std::fs::remove_file(&tmp_plist);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("User canceled") || stderr.contains("-128") {
                return Err("User canceled administrator authorization".into());
            }
            return Err(format!("Daemon install failed: {stderr}"));
        }

        Ok(())
    }

    /// Poll for the daemon socket to appear after bootstrap. launchd starts the
    /// daemon asynchronously, so we give it a few seconds before giving up.
    fn wait_for_daemon_socket(timeout: Duration) -> Result<(), String> {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if Path::new(DAEMON_SOCKET_PATH).exists() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(100));
        }
        Err(format!(
            "Daemon socket {DAEMON_SOCKET_PATH} did not appear within {:?}",
            timeout
        ))
    }

    /// Production path — ensure the daemon is installed+running, then connect.
    /// Returns a connected stream ready for the reader thread.
    fn connect_daemon(helper_path: &Path) -> Result<UnixStream, String> {
        if !Self::daemon_is_current(helper_path) {
            Self::install_daemon(helper_path)?;
            Self::wait_for_daemon_socket(Duration::from_secs(10))?;
        } else if !Path::new(DAEMON_SOCKET_PATH).exists() {
            // Plist is current but socket missing — daemon may be restarting.
            Self::wait_for_daemon_socket(Duration::from_secs(5))?;
        }

        UnixStream::connect(DAEMON_SOCKET_PATH)
            .map_err(|e| format!("Failed to connect to daemon at {DAEMON_SOCKET_PATH}: {e}"))
    }

    /// Legacy dev path — create a per-PID listener and launch the helper via
    /// osascript. Kept verbatim from the original flow for non-production builds.
    fn legacy_launch_helper(
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
                eprintln!("[Accel] Launching legacy helper via osascript...");
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

    fn create_legacy_socket() -> Result<(UnixListener, PathBuf), String> {
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

    /// Wait for helper to connect, with timeout and cancellation.
    fn legacy_accept_with_timeout(
        listener: &UnixListener,
        alive: &AtomicBool,
        timeout: Duration,
    ) -> Result<UnixStream, String> {
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

    /// Ensure the helper connection is active. Lazily installs the daemon on
    /// first production run or, in dev builds, launches the helper via osascript.
    fn ensure_helper<R: Runtime>(&self, app: AppHandle<R>) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;

        // Reuse an existing live connection.
        if let Some(ref state) = *guard {
            if state.alive.load(Ordering::Relaxed) {
                return Ok(());
            }
            eprintln!("[Accel] Existing connection dead, re-establishing...");
        }

        // Drop any dead state first.
        if let Some(old) = guard.take() {
            if let Some(path) = &old.legacy_socket_path {
                let _ = std::fs::remove_file(path);
            }
            if let Some(t) = old.reader_thread {
                let _ = t.join();
            }
            if let Some(t) = old.osascript_thread {
                let _ = t.join();
            }
        }

        let helper_path = Self::resolve_helper_path()?;
        let use_daemon = Self::is_production_install(&helper_path);

        let alive = Arc::new(AtomicBool::new(true));
        let emitting = Arc::new(AtomicBool::new(false));
        let calibrating = Arc::new(AtomicBool::new(false));
        let calibration_samples: Arc<Mutex<Vec<AccelSample>>> =
            Arc::new(Mutex::new(Vec::with_capacity(200)));

        let (stream, osascript_thread, legacy_socket_path) = if use_daemon {
            let stream = Self::connect_daemon(&helper_path)?;
            eprintln!("[Accel] Connected to LaunchDaemon at {DAEMON_SOCKET_PATH}");
            (stream, None, None)
        } else {
            eprintln!("[Accel] Dev mode — using legacy osascript flow");
            let (listener, socket_path) = Self::create_legacy_socket()?;
            let osascript_thread = Self::legacy_launch_helper(&helper_path, &socket_path);

            // Wait for the launched helper to connect back.
            let stream = Self::legacy_accept_with_timeout(
                &listener,
                &alive,
                Duration::from_secs(30),
            )?;
            (stream, Some(osascript_thread), Some(socket_path))
        };

        // Reader thread — identical logic for daemon and legacy modes once the
        // stream is established.
        let alive_clone = alive.clone();
        let emitting_clone = emitting.clone();
        let calibrating_clone = calibrating.clone();
        let samples_clone = calibration_samples.clone();
        let legacy_socket_clone = legacy_socket_path.clone();
        let start_time = Instant::now();

        let reader_thread = thread::Builder::new()
            .name("accel-reader".into())
            .spawn(move || {
                let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
                let mut buf = [0u8; 24];
                let mut count: u64 = 0;
                let mut stream = stream;

                loop {
                    if !alive_clone.load(Ordering::Relaxed) {
                        break;
                    }

                    match stream.read_exact(&mut buf) {
                        Ok(()) => {
                            count += 1;
                            let x = f64::from_le_bytes(buf[0..8].try_into().unwrap());
                            let y = f64::from_le_bytes(buf[8..16].try_into().unwrap());
                            let z = f64::from_le_bytes(buf[16..24].try_into().unwrap());

                            if count == 1 {
                                eprintln!("[Accel] First sample: x={x:.4} y={y:.4} z={z:.4}");
                            }
                            if count % 500 == 0 {
                                eprintln!("[Accel] Received {count} samples");
                            }

                            if calibrating_clone.load(Ordering::Relaxed) {
                                if let Ok(mut samples) = samples_clone.lock() {
                                    samples.push(AccelSample { x, y, z });
                                }
                            }

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
                            eprintln!("[Accel] Connection closed after {count} samples");
                            break;
                        }
                    }
                }

                alive_clone.store(false, Ordering::Relaxed);
                if let Some(path) = legacy_socket_clone {
                    let _ = std::fs::remove_file(path);
                }
            })
            .map_err(|e| format!("Failed to spawn reader thread: {e}"))?;

        *guard = Some(HelperState {
            alive,
            emitting,
            calibrating,
            calibration_samples,
            reader_thread: Some(reader_thread),
            osascript_thread,
            legacy_socket_path,
        });

        Ok(())
    }

    /// Start emitting accelerometer events. Ensures the helper is connected.
    pub fn start<R: Runtime>(&self, app: AppHandle<R>) -> Result<(), String> {
        self.ensure_helper(app)?;

        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(ref state) = *guard {
            state.emitting.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    /// Stop emitting accelerometer events. Helper/daemon stays alive for reuse.
    pub fn stop(&self) -> Result<(), String> {
        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(ref state) = *guard {
            state.emitting.store(false, Ordering::Relaxed);
        }
        Ok(())
    }

    /// Collect samples for 1 second and return the average baseline.
    pub async fn calibrate<R: Runtime>(
        &self,
        app: AppHandle<R>,
    ) -> Result<CalibrationResult, String> {
        self.ensure_helper(app)?;

        let (calibrating, calibration_samples) = {
            let guard = self.inner.lock().map_err(|e| e.to_string())?;
            let state = guard.as_ref().ok_or("Helper not running")?;

            state.emitting.store(false, Ordering::Relaxed);
            (state.calibrating.clone(), state.calibration_samples.clone())
        };

        if let Ok(mut samples) = calibration_samples.lock() {
            samples.clear();
        }
        calibrating.store(true, Ordering::Relaxed);

        thread::sleep(Duration::from_secs(1));

        calibrating.store(false, Ordering::Relaxed);

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
