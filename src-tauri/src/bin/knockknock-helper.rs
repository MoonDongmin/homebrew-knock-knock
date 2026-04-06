//! Privileged helper for KnockKnock accelerometer access.
//!
//! Launched by the main app via `osascript ... with administrator privileges`.
//! Reads IOKit HID accelerometer data and streams samples over a Unix domain socket.
//! Each sample is 24 bytes: x(f64 LE) + y(f64 LE) + z(f64 LE).

use std::io::Write;
use std::os::unix::net::UnixStream;
use std::sync::{Arc, Mutex};
use tauri_plugin_accelerometer::iokit_hid::{AccelSample, HidStream, SendableRunLoop};

fn main() {
    let socket_path = match std::env::args().nth(1) {
        Some(p) => p,
        None => {
            eprintln!("[helper] Usage: knockknock-helper <socket-path>");
            std::process::exit(1);
        }
    };

    eprintln!("[helper] Connecting to {socket_path}");
    let stream = match UnixStream::connect(&socket_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[helper] Failed to connect to socket: {e}");
            std::process::exit(1);
        }
    };

    let stream = Arc::new(Mutex::new(stream));
    let stream_clone = stream.clone();
    let run_loop: Arc<Mutex<Option<SendableRunLoop>>> = Arc::new(Mutex::new(None));

    let callback = Box::new(move |sample: AccelSample| {
        let mut buf = [0u8; 24];
        buf[0..8].copy_from_slice(&sample.x.to_le_bytes());
        buf[8..16].copy_from_slice(&sample.y.to_le_bytes());
        buf[16..24].copy_from_slice(&sample.z.to_le_bytes());

        if let Ok(mut s) = stream_clone.lock() {
            if s.write_all(&buf).is_err() {
                // Socket closed by main app — exit cleanly
                std::process::exit(0);
            }
        }
    });

    eprintln!("[helper] Starting HID stream...");
    match HidStream::run_on_current_thread(callback, &run_loop) {
        Ok(()) => eprintln!("[helper] HID stream ended"),
        Err(e) => {
            eprintln!("[helper] HID stream error: {e}");
            std::process::exit(1);
        }
    }
}
