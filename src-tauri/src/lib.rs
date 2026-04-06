mod commands;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_accelerometer::init())
        .invoke_handler(tauri::generate_handler![
            commands::system_actions::simulate_media_key,
            commands::system_actions::simulate_keyboard_shortcut,
            commands::system_actions::check_accessibility,
            commands::audio::play_feedback_sound,
            commands::app_list::list_installed_apps,
        ])
        .setup(|app| {
            tray::create_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide the window instead of closing — Cmd+Q still quits via app exit
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
