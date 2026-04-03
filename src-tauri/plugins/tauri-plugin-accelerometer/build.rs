const COMMANDS: &[&str] = &["start_stream", "stop_stream", "is_available", "calibrate"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
