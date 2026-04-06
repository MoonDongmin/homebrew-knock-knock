use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
    pub bundle_id: Option<String>,
}

fn scan_apps_in_dir(dir: &Path, apps: &mut Vec<InstalledApp>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.extension().is_some_and(|ext| ext == "app") {
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            if name.is_empty() {
                continue;
            }

            let bundle_id = read_bundle_id(&path);

            apps.push(InstalledApp {
                name,
                path: path.to_string_lossy().to_string(),
                bundle_id,
            });
        }
    }
}

fn read_bundle_id(app_path: &Path) -> Option<String> {
    let plist_path = app_path.join("Contents/Info.plist");
    let value = plist::Value::from_file(&plist_path).ok()?;
    let dict = value.as_dictionary()?;
    let id = dict.get("CFBundleIdentifier")?.as_string()?;
    Some(id.to_string())
}

#[tauri::command]
pub fn list_installed_apps() -> Vec<InstalledApp> {
    let mut apps = Vec::new();

    let scan_dirs = [
        "/Applications",
        "/Applications/Utilities",
        "/System/Applications",
        "/System/Applications/Utilities",
    ];

    for dir in &scan_dirs {
        scan_apps_in_dir(Path::new(dir), &mut apps);
    }

    // ~/Applications
    if let Ok(home) = std::env::var("HOME") {
        scan_apps_in_dir(&Path::new(&home).join("Applications"), &mut apps);
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    // Deduplicate by name
    apps.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));

    apps
}
