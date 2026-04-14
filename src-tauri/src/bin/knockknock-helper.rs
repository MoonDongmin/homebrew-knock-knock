//! Privileged helper for KnockKnock accelerometer access.
//!
//! Two modes:
//!
//! * **Legacy client mode** (`knockknock-helper <socket-path>`) — the main app
//!   launches the helper via `osascript ... with administrator privileges` and
//!   passes a per-PID socket path. The helper connects back and streams samples
//!   until the app exits. Used in dev builds where the helper lives outside
//!   `/Applications/`.
//!
//! * **Daemon mode** (`knockknock-helper --daemon`) — invoked by `launchd` from
//!   `/Library/LaunchDaemons/com.knockknock.helper.plist`. Binds the well-known
//!   socket at `/var/run/com.knockknock.helper.sock`, accepts connections from
//!   the main app, runs the HID stream on the main thread and pipes samples to
//!   whichever client is currently connected.
//!
//! Each 24-byte message on the wire: x(f64 LE) + y(f64 LE) + z(f64 LE).

use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri_plugin_accelerometer::iokit_hid::{AccelSample, HidStream, SendableRunLoop};

const DAEMON_SOCKET_PATH: &str = "/var/run/com.knockknock.helper.sock";

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--daemon") => run_daemon(),
        Some(path) => run_client(path.to_string()),
        None => {
            eprintln!("[helper] usage: knockknock-helper <socket-path> | --daemon");
            std::process::exit(1);
        }
    }
}

fn encode_sample(sample: AccelSample) -> [u8; 24] {
    let mut buf = [0u8; 24];
    buf[0..8].copy_from_slice(&sample.x.to_le_bytes());
    buf[8..16].copy_from_slice(&sample.y.to_le_bytes());
    buf[16..24].copy_from_slice(&sample.z.to_le_bytes());
    buf
}

/// Legacy client mode — connect to the parent's per-PID socket and stream until
/// the connection drops. Used in dev where the helper is launched per-session.
fn run_client(socket_path: String) {
    eprintln!("[helper] client mode, connecting to {socket_path}");
    let stream = match UnixStream::connect(&socket_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[helper] connect failed: {e}");
            std::process::exit(1);
        }
    };

    let stream = Arc::new(Mutex::new(stream));
    let stream_clone = stream.clone();
    let run_loop: Arc<Mutex<Option<SendableRunLoop>>> = Arc::new(Mutex::new(None));

    let callback = Box::new(move |sample: AccelSample| {
        let buf = encode_sample(sample);
        if let Ok(mut s) = stream_clone.lock() {
            if s.write_all(&buf).is_err() {
                std::process::exit(0);
            }
        }
    });

    match HidStream::run_on_current_thread(callback, &run_loop) {
        Ok(()) => eprintln!("[helper] HID stream ended"),
        Err(e) => {
            eprintln!("[helper] HID stream error: {e}");
            std::process::exit(1);
        }
    }
}

/// Daemon mode — bound to a fixed socket, accepts many clients over the process
/// lifetime, runs the HID stream on the main thread and pipes samples to the
/// currently-connected client (if any). launchd keeps the process alive.
fn run_daemon() {
    let _ = std::fs::remove_file(DAEMON_SOCKET_PATH);
    let listener = match UnixListener::bind(DAEMON_SOCKET_PATH) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[helper] bind {DAEMON_SOCKET_PATH} failed: {e}");
            std::process::exit(1);
        }
    };
    if let Err(e) =
        std::fs::set_permissions(DAEMON_SOCKET_PATH, std::fs::Permissions::from_mode(0o666))
    {
        eprintln!("[helper] chmod socket failed: {e}");
    }
    eprintln!("[helper] daemon listening on {DAEMON_SOCKET_PATH}");

    // Shared current client — HID callback writes to whoever is here.
    let current: Arc<Mutex<Option<UnixStream>>> = Arc::new(Mutex::new(None));

    // Acceptor thread: accept loop, most recent client wins.
    let accept_current = current.clone();
    thread::Builder::new()
        .name("acceptor".into())
        .spawn(move || loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    eprintln!("[helper] client connected");
                    if let Ok(mut guard) = accept_current.lock() {
                        *guard = Some(stream);
                    }
                }
                Err(e) => {
                    eprintln!("[helper] accept error: {e}");
                    thread::sleep(Duration::from_millis(200));
                }
            }
        })
        .expect("spawn acceptor thread");

    // HID stream on the main thread (needs CFRunLoop).
    let cb_current = current.clone();
    let run_loop: Arc<Mutex<Option<SendableRunLoop>>> = Arc::new(Mutex::new(None));
    let callback = Box::new(move |sample: AccelSample| {
        let buf = encode_sample(sample);
        let mut guard = match cb_current.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if let Some(ref mut stream) = *guard {
            if stream.write_all(&buf).is_err() {
                eprintln!("[helper] client disconnected");
                *guard = None;
            }
        }
    });

    if let Err(e) = HidStream::run_on_current_thread(callback, &run_loop) {
        eprintln!("[helper] HID stream error: {e}");
        std::process::exit(1);
    }
}
