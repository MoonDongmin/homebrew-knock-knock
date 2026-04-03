use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
pub mod desktop;
pub mod iokit_hid;

pub use desktop::AccelerometerState;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("accelerometer")
        .invoke_handler(tauri::generate_handler![
            commands::start_stream,
            commands::stop_stream,
            commands::is_available,
            commands::calibrate,
        ])
        .setup(|app, _api| {
            app.manage(AccelerometerState::default());
            Ok(())
        })
        .build()
}
