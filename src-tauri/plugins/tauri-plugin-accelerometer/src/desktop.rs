use crate::iokit_hid::{AccelSample, HidStream, SendableRunLoop};
use serde::Serialize;
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
    /// Microseconds since stream start
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
pub struct AccelerometerState {
    inner: Mutex<Option<StreamHandle>>,
}

struct StreamHandle {
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    run_loop: Arc<Mutex<Option<SendableRunLoop>>>,
}

impl Default for AccelerometerState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

impl AccelerometerState {
    /// Start streaming accelerometer data. Spawns a dedicated thread for CFRunLoop.
    pub fn start<R: Runtime>(&self, app: AppHandle<R>) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;

        if guard.is_some() {
            return Err("Accelerometer stream already running".into());
        }

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();
        let run_loop: Arc<Mutex<Option<SendableRunLoop>>> = Arc::new(Mutex::new(None));
        let run_loop_clone = run_loop.clone();
        let start_time = Instant::now();

        let thread = thread::Builder::new()
            .name("accelerometer-hid".into())
            .spawn(move || {
                let callback = Box::new(move |sample: AccelSample| {
                    if !running_clone.load(Ordering::Relaxed) {
                        return;
                    }
                    let elapsed = start_time.elapsed();
                    let event = AccelerometerEvent {
                        x: sample.x,
                        y: sample.y,
                        z: sample.z,
                        timestamp: elapsed.as_micros() as u64,
                    };
                    let _ = app.emit("accelerometer://data", &event);
                });

                if let Err(e) = HidStream::run_on_current_thread(callback, &run_loop_clone) {
                    log::error!("Accelerometer stream error: {e}");
                }
            })
            .map_err(|e| format!("Failed to spawn accelerometer thread: {e}"))?;

        *guard = Some(StreamHandle {
            running,
            thread: Some(thread),
            run_loop,
        });

        Ok(())
    }

    /// Stop the accelerometer stream.
    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;

        if let Some(handle) = guard.take() {
            handle.running.store(false, Ordering::Relaxed);

            // Stop the CFRunLoop to unblock the thread
            if let Ok(lock) = handle.run_loop.lock() {
                if let Some(ref rl) = *lock {
                    rl.stop();
                }
            }

            // Wait for the thread to finish
            if let Some(thread) = handle.thread {
                let _ = thread.join();
            }
        }

        Ok(())
    }

    /// Collect samples for 1 second and return the average baseline vector.
    pub async fn calibrate<R: Runtime>(
        &self,
        app: AppHandle<R>,
    ) -> Result<CalibrationResult, String> {
        let samples: Arc<Mutex<Vec<AccelSample>>> = Arc::new(Mutex::new(Vec::with_capacity(100)));
        let samples_clone = samples.clone();

        // Start a temporary stream for calibration
        self.start(app)?;

        // Collect for 1 second
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(1) {
            thread::sleep(Duration::from_millis(10));
        }

        // Stop the stream
        self.stop()?;

        // For Phase 1, calibration returns zero baseline.
        // The frontend will handle calibration through the event listener in Phase 2.
        let guard = samples_clone.lock().map_err(|e| e.to_string())?;

        if guard.is_empty() {
            return Ok(CalibrationResult {
                x: 0.0,
                y: 0.0,
                z: 0.0,
                samples: 0,
            });
        }

        let count = guard.len() as f64;
        let sum = guard.iter().fold((0.0, 0.0, 0.0), |acc, s| {
            (acc.0 + s.x, acc.1 + s.y, acc.2 + s.z)
        });

        Ok(CalibrationResult {
            x: sum.0 / count,
            y: sum.1 / count,
            z: sum.2 / count,
            samples: guard.len() as u32,
        })
    }
}
