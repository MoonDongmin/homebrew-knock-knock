use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct SoundResult {
    pub success: bool,
}

struct CustomSound {
    resource: &'static str,
    rate: f32,
}

/// Custom sounds bundled as resources (name → resource path + playback rate).
/// Resource paths are relative to src-tauri/ (matches `"resources": ["voice/*"]`
/// in tauri.conf.json) and map to Contents/Resources/voice/ inside the .app bundle.
fn custom_sound(sound_name: &str) -> Option<CustomSound> {
    match sound_name {
        "angerychan9" => Some(CustomSound { resource: "voice/angerychan9.mp3", rate: 2.0 }),
        "chan9" => Some(CustomSound { resource: "voice/chan9.mp3", rate: 1.0 }),
        _ => None,
    }
}

/// Resolve a bundled resource file path.
/// In production: uses Tauri's resource directory (inside .app bundle).
/// In dev: falls back to the same path relative to src-tauri/.
fn resolve_sound_resource(app: &AppHandle, resource: &str) -> Result<PathBuf, String> {
    if let Ok(path) = app.path().resolve(resource, BaseDirectory::Resource) {
        if path.exists() {
            return Ok(path);
        }
    }

    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(resource);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!("Sound file not found: {resource}"))
}

#[tauri::command]
pub fn play_feedback_sound(
    app: AppHandle,
    sound_name: String,
) -> Result<SoundResult, String> {
    if let Some(sound) = custom_sound(&sound_name) {
        let resource_path = resolve_sound_resource(&app, sound.resource)?;
        let rate = sound.rate;

        std::thread::spawn(move || {
            let _ = Command::new("afplay")
                .arg("-r")
                .arg(rate.to_string())
                .arg(resource_path)
                .output();
        });

        Ok(SoundResult { success: true })
    } else {
        // System sound via NSSound
        use objc2_app_kit::NSSound;
        use objc2_foundation::NSString;

        let ns_name = NSString::from_str(&sound_name);
        let sound = NSSound::soundNamed(&ns_name);

        match sound {
            Some(s) => {
                s.play();
                Ok(SoundResult { success: true })
            }
            None => Err(format!("System sound not found: {sound_name}")),
        }
    }
}
