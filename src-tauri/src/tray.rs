use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Listener, Manager,
};

/// Holds a reference to the toggle menu item so we can update its text.
pub struct ToggleMenuItem(pub Mutex<MenuItem<tauri::Wry>>);

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show_settings =
        MenuItem::with_id(app, "show_settings", "Show Settings", true, None::<&str>)?;
    let toggle_monitoring =
        MenuItem::with_id(app, "toggle_monitoring", "App Off", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit KnockKnock", true, None::<&str>)?;

    // Store the toggle item so we can update its text later
    let toggle_clone = toggle_monitoring.clone();
    app.manage(ToggleMenuItem(Mutex::new(toggle_clone)));

    let menu = Menu::with_items(
        app,
        &[&show_settings, &toggle_monitoring, &separator, &quit],
    )?;

    TrayIconBuilder::with_id("main-tray")
        .icon(tauri::include_image!("icons/tray-icon.png"))
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "toggle_monitoring" => {
                let _ = app.emit("knockknock://toggle-monitoring", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    // Listen for monitoring state changes from the frontend
    let app_handle = app.handle().clone();
    app.listen("knockknock://monitoring-state", move |event: tauri::Event| {
        let is_on = event.payload() == "\"true\"";
        let label = if is_on { "App Off" } else { "App On" };

        if let Some(toggle) = app_handle.try_state::<ToggleMenuItem>() {
            if let Ok(item) = toggle.0.lock() {
                let _ = item.set_text(label);
            }
        }
    });

    Ok(())
}
