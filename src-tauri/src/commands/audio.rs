use serde::Serialize;

#[derive(Serialize)]
pub struct SoundResult {
    pub success: bool,
}

#[tauri::command]
pub fn play_feedback_sound(sound_name: String) -> Result<SoundResult, String> {
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
