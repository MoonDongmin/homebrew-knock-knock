use objc2_app_kit::{NSEvent, NSEventModifierFlags, NSEventType};
use objc2_core_graphics::{CGEvent, CGEventTapLocation};
use objc2_foundation::NSPoint;
use serde::Serialize;
use std::ffi::c_void;

// CoreGraphics FFI — used for keyboard shortcuts only
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventCreateKeyboardEvent(
        source: *const c_void,
        keycode: u16,
        key_down: bool,
    ) -> *mut c_void;
    fn CGEventPost(tap: u32, event: *const c_void);
    fn CGEventSetFlags(event: *mut c_void, flags: u64);
    fn CFRelease(cf: *const c_void);
}

/// kCGHIDEventTap
const CG_HID_EVENT_TAP: u32 = 0;

/// NX key types for media keys
const NX_KEYTYPE_SOUND_UP: isize = 0;
const NX_KEYTYPE_SOUND_DOWN: isize = 1;
const NX_KEYTYPE_MUTE: isize = 7;
const NX_KEYTYPE_PLAY: isize = 16;
const NX_KEYTYPE_NEXT: isize = 17;
const NX_KEYTYPE_PREVIOUS: isize = 18;

/// NX_SUBTYPE_AUX_CONTROL_BUTTONS — required subtype for media key events
const NX_SUBTYPE_AUX_CONTROL_BUTTONS: i16 = 8;

/// CGEvent modifier flags for keyboard shortcuts
const CG_EVENT_FLAG_MASK_COMMAND: u64 = 1 << 20;
const CG_EVENT_FLAG_MASK_SHIFT: u64 = 1 << 17;
const CG_EVENT_FLAG_MASK_ALTERNATE: u64 = 1 << 19;
const CG_EVENT_FLAG_MASK_CONTROL: u64 = 1 << 18;

#[derive(Serialize)]
pub struct MediaKeyResult {
    pub success: bool,
}

#[derive(Serialize)]
pub struct ShortcutResult {
    pub success: bool,
}

fn media_key_code(key: &str) -> Result<isize, String> {
    match key {
        "play_pause" => Ok(NX_KEYTYPE_PLAY),
        "next_track" => Ok(NX_KEYTYPE_NEXT),
        "previous_track" => Ok(NX_KEYTYPE_PREVIOUS),
        "volume_up" => Ok(NX_KEYTYPE_SOUND_UP),
        "volume_down" => Ok(NX_KEYTYPE_SOUND_DOWN),
        "mute" => Ok(NX_KEYTYPE_MUTE),
        _ => Err(format!("Unknown media key: {key}")),
    }
}

/// Post a media key event using NSEvent with proper subtype 8.
///
/// CGEventCreate + CGEventSetType(NX_SYSDEFINED) doesn't set the subtype,
/// causing macOS to ignore the event. NSEvent's `otherEventWithType:` properly
/// sets subtype to NX_SUBTYPE_AUX_CONTROL_BUTTONS (8), which is required
/// for media key delivery.
fn post_media_key_event(key_type: isize) {
    let location = NSPoint::new(0.0, 0.0);

    // Key-down
    let data1_down = (key_type << 16) | (0x0a << 8);
    let flags_down = NSEventModifierFlags(0xa00);

    if let Some(ns_event) =
        NSEvent::otherEventWithType_location_modifierFlags_timestamp_windowNumber_context_subtype_data1_data2(
            NSEventType::SystemDefined,
            location,
            flags_down,
            0.0,
            0,
            None,
            NX_SUBTYPE_AUX_CONTROL_BUTTONS,
            data1_down,
            -1,
        )
    {
        if let Some(cg_event) = ns_event.CGEvent() {
            CGEvent::post(CGEventTapLocation::SessionEventTap, Some(&cg_event));
        }
    }

    std::thread::sleep(std::time::Duration::from_millis(10));

    // Key-up
    let data1_up = (key_type << 16) | (0x0b << 8);
    let flags_up = NSEventModifierFlags(0xb00);

    if let Some(ns_event) =
        NSEvent::otherEventWithType_location_modifierFlags_timestamp_windowNumber_context_subtype_data1_data2(
            NSEventType::SystemDefined,
            location,
            flags_up,
            0.0,
            0,
            None,
            NX_SUBTYPE_AUX_CONTROL_BUTTONS,
            data1_up,
            -1,
        )
    {
        if let Some(cg_event) = ns_event.CGEvent() {
            CGEvent::post(CGEventTapLocation::SessionEventTap, Some(&cg_event));
        }
    }
}

/// Map a key name to a virtual keycode.
fn virtual_keycode(key: &str) -> Result<u16, String> {
    match key.to_lowercase().as_str() {
        "a" => Ok(0x00),
        "s" => Ok(0x01),
        "d" => Ok(0x02),
        "f" => Ok(0x03),
        "h" => Ok(0x04),
        "g" => Ok(0x05),
        "z" => Ok(0x06),
        "x" => Ok(0x07),
        "c" => Ok(0x08),
        "v" => Ok(0x09),
        "b" => Ok(0x0B),
        "q" => Ok(0x0C),
        "w" => Ok(0x0D),
        "e" => Ok(0x0E),
        "r" => Ok(0x0F),
        "y" => Ok(0x10),
        "t" => Ok(0x11),
        "1" => Ok(0x12),
        "2" => Ok(0x13),
        "3" => Ok(0x14),
        "4" => Ok(0x15),
        "6" => Ok(0x16),
        "5" => Ok(0x17),
        "=" => Ok(0x18),
        "9" => Ok(0x19),
        "7" => Ok(0x1A),
        "-" => Ok(0x1B),
        "8" => Ok(0x1C),
        "0" => Ok(0x1D),
        "]" => Ok(0x1E),
        "o" => Ok(0x1F),
        "u" => Ok(0x20),
        "[" => Ok(0x21),
        "i" => Ok(0x22),
        "p" => Ok(0x23),
        "return" | "enter" => Ok(0x24),
        "l" => Ok(0x25),
        "j" => Ok(0x26),
        "'" => Ok(0x27),
        "k" => Ok(0x28),
        ";" => Ok(0x29),
        "\\" => Ok(0x2A),
        "," => Ok(0x2B),
        "/" => Ok(0x2C),
        "n" => Ok(0x2D),
        "m" => Ok(0x2E),
        "." => Ok(0x2F),
        "tab" => Ok(0x30),
        "space" => Ok(0x31),
        "`" => Ok(0x32),
        "delete" | "backspace" => Ok(0x33),
        "escape" | "esc" => Ok(0x35),
        "f1" => Ok(0x7A),
        "f2" => Ok(0x78),
        "f3" => Ok(0x63),
        "f4" => Ok(0x76),
        "f5" => Ok(0x60),
        "f6" => Ok(0x61),
        "f7" => Ok(0x62),
        "f8" => Ok(0x64),
        "f9" => Ok(0x65),
        "f10" => Ok(0x6D),
        "f11" => Ok(0x67),
        "f12" => Ok(0x6F),
        "left" => Ok(0x7B),
        "right" => Ok(0x7C),
        "down" => Ok(0x7D),
        "up" => Ok(0x7E),
        _ => Err(format!("Unknown key: {key}")),
    }
}

fn modifier_flag(modifier: &str) -> Result<u64, String> {
    match modifier.to_lowercase().as_str() {
        "cmd" | "command" => Ok(CG_EVENT_FLAG_MASK_COMMAND),
        "shift" => Ok(CG_EVENT_FLAG_MASK_SHIFT),
        "alt" | "option" => Ok(CG_EVENT_FLAG_MASK_ALTERNATE),
        "ctrl" | "control" => Ok(CG_EVENT_FLAG_MASK_CONTROL),
        _ => Err(format!("Unknown modifier: {modifier}")),
    }
}

// ApplicationServices FFI for accessibility check
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
}

// CoreFoundation helpers for building the options dict
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFDictionaryCreate(
        allocator: *const c_void,
        keys: *const *const c_void,
        values: *const *const c_void,
        num_values: isize,
        key_callbacks: *const c_void,
        value_callbacks: *const c_void,
    ) -> *const c_void;

    static kCFBooleanTrue: *const c_void;
    static kCFBooleanFalse: *const c_void;
    static kCFTypeDictionaryKeyCallBacks: c_void;
    static kCFTypeDictionaryValueCallBacks: c_void;
}

unsafe extern "C" {
    // This key constant lives in ApplicationServices
    static kAXTrustedCheckOptionPrompt: *const c_void;
}

/// Check if the app has accessibility permissions.
/// If `prompt` is true, macOS will show the permission dialog.
#[tauri::command]
pub fn check_accessibility(prompt: bool) -> bool {
    unsafe {
        let prompt_value = if prompt {
            kCFBooleanTrue
        } else {
            kCFBooleanFalse
        };

        let keys = [kAXTrustedCheckOptionPrompt];
        let values = [prompt_value];

        let options = CFDictionaryCreate(
            std::ptr::null(),
            keys.as_ptr(),
            values.as_ptr(),
            1,
            &kCFTypeDictionaryKeyCallBacks as *const _ as *const c_void,
            &kCFTypeDictionaryValueCallBacks as *const _ as *const c_void,
        );

        let trusted = AXIsProcessTrustedWithOptions(options);
        CFRelease(options);
        trusted
    }
}

#[tauri::command]
pub fn simulate_media_key(key: String) -> Result<MediaKeyResult, String> {
    let key_type = media_key_code(&key)?;
    post_media_key_event(key_type);
    Ok(MediaKeyResult { success: true })
}

#[tauri::command]
pub fn simulate_keyboard_shortcut(
    keys: Vec<String>,
    modifiers: Vec<String>,
) -> Result<ShortcutResult, String> {
    let mut flags: u64 = 0;
    for m in &modifiers {
        flags |= modifier_flag(m)?;
    }

    unsafe {
        // Press each key down with modifier flags
        for key in &keys {
            let keycode = virtual_keycode(key)?;
            let event = CGEventCreateKeyboardEvent(std::ptr::null(), keycode, true);
            if event.is_null() {
                return Err("Failed to create key-down event".to_string());
            }
            CGEventSetFlags(event, flags);
            CGEventPost(CG_HID_EVENT_TAP, event);
            CFRelease(event);
        }

        // Release each key in reverse order
        for key in keys.iter().rev() {
            let keycode = virtual_keycode(key)?;
            let event = CGEventCreateKeyboardEvent(std::ptr::null(), keycode, false);
            if event.is_null() {
                return Err("Failed to create key-up event".to_string());
            }
            CGEventSetFlags(event, flags);
            CGEventPost(CG_HID_EVENT_TAP, event);
            CFRelease(event);
        }
    }

    Ok(ShortcutResult { success: true })
}
