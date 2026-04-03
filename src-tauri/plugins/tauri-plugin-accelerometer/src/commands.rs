use crate::desktop::{AccelerometerState, CalibrationResult};
use crate::iokit_hid;
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn start_stream<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AccelerometerState>,
) -> Result<(), String> {
    state.start(app)
}

#[tauri::command]
pub async fn stop_stream(state: State<'_, AccelerometerState>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub async fn is_available() -> Result<bool, String> {
    Ok(iokit_hid::is_device_available())
}

#[tauri::command]
pub async fn calibrate<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AccelerometerState>,
) -> Result<CalibrationResult, String> {
    state.calibrate(app).await
}
