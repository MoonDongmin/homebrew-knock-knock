//! Raw IOKit HID FFI bindings for Apple Silicon accelerometer access.
//!
//! The accelerometer is exposed as an `AppleSPUHIDDevice` with:
//! - Usage Page: 0xFF00 (vendor-defined)
//! - Usage: 3 (accelerometer)
//! - Report: 22 bytes → x/y/z as i32 LE at offsets 6/10/14, divide by 65536.0 = g-force

use core_foundation::base::{kCFAllocatorDefault, CFRelease, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::runloop::{CFRunLoopGetCurrent, CFRunLoopRef, CFRunLoopRun, CFRunLoopStop};
use core_foundation::string::CFString;
use core_foundation_sys::base::{CFAllocatorRef, CFIndex};
use core_foundation_sys::dictionary::CFDictionaryRef;
use core_foundation_sys::runloop::kCFRunLoopDefaultMode;
use core_foundation_sys::set::CFSetRef;
use std::ffi::c_void;

// IOKit HID opaque types
pub type IOHIDManagerRef = *mut c_void;
pub type IOHIDDeviceRef = *mut c_void;
type IOOptionBits = u32;
type IOReturn = i32;

/// HID report callback signature
pub type IOHIDReportCallback = extern "C" fn(
    context: *mut c_void,
    result: IOReturn,
    sender: IOHIDDeviceRef,
    report_type: u32,
    report_id: u32,
    report: *mut u8,
    report_length: CFIndex,
);

/// CFSet callback for applying a function to each value
type CFSetApplierFunction = extern "C" fn(value: *const c_void, context: *mut c_void);

#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOHIDManagerCreate(allocator: CFAllocatorRef, options: IOOptionBits) -> IOHIDManagerRef;
    fn IOHIDManagerSetDeviceMatching(manager: IOHIDManagerRef, matching: CFDictionaryRef);
    fn IOHIDManagerCopyDevices(manager: IOHIDManagerRef) -> CFSetRef;
    fn IOHIDManagerOpen(manager: IOHIDManagerRef, options: IOOptionBits) -> IOReturn;
    fn IOHIDManagerClose(manager: IOHIDManagerRef, options: IOOptionBits) -> IOReturn;
    fn IOHIDManagerScheduleWithRunLoop(
        manager: IOHIDManagerRef,
        run_loop: CFRunLoopRef,
        run_loop_mode: *const c_void,
    );
    fn IOHIDManagerUnscheduleFromRunLoop(
        manager: IOHIDManagerRef,
        run_loop: CFRunLoopRef,
        run_loop_mode: *const c_void,
    );
    fn IOHIDDeviceRegisterInputReportCallback(
        device: IOHIDDeviceRef,
        report: *mut u8,
        report_length: CFIndex,
        callback: IOHIDReportCallback,
        context: *mut c_void,
    );
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFSetGetCount(set: CFSetRef) -> CFIndex;
    fn CFSetApplyFunction(set: CFSetRef, applier: CFSetApplierFunction, context: *mut c_void);
}

const USAGE_PAGE_VENDOR: i32 = 0xFF00;
const USAGE_ACCELEROMETER: i32 = 3;
const REPORT_LENGTH: usize = 22;

/// Parsed accelerometer sample in g-force units.
#[derive(Debug, Clone, Copy)]
pub struct AccelSample {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Parse a 22-byte HID report into an accelerometer sample.
pub fn parse_report(report: &[u8]) -> Option<AccelSample> {
    if report.len() < 18 {
        return None;
    }
    let x = i32::from_le_bytes(report[6..10].try_into().ok()?) as f64 / 65536.0;
    let y = i32::from_le_bytes(report[10..14].try_into().ok()?) as f64 / 65536.0;
    let z = i32::from_le_bytes(report[14..18].try_into().ok()?) as f64 / 65536.0;
    Some(AccelSample { x, y, z })
}

/// Build a matching dictionary for the accelerometer HID device.
fn build_matching_dict() -> CFDictionary<CFString, CFNumber> {
    let key_usage_page = CFString::new("DeviceUsagePage");
    let key_usage = CFString::new("DeviceUsage");
    let val_usage_page = CFNumber::from(USAGE_PAGE_VENDOR);
    let val_usage = CFNumber::from(USAGE_ACCELEROMETER);

    CFDictionary::from_CFType_pairs(&[
        (key_usage_page, val_usage_page),
        (key_usage, val_usage),
    ])
}

/// Collect all device pointers from a CFSet into a Vec.
fn collect_devices_from_set(set_ref: CFSetRef) -> Vec<IOHIDDeviceRef> {
    let count = unsafe { CFSetGetCount(set_ref) } as usize;
    if count == 0 {
        return Vec::new();
    }

    let mut devices: Vec<IOHIDDeviceRef> = Vec::with_capacity(count);

    extern "C" fn collect_applier(value: *const c_void, context: *mut c_void) {
        let vec = unsafe { &mut *(context as *mut Vec<IOHIDDeviceRef>) };
        vec.push(value as IOHIDDeviceRef);
    }

    unsafe {
        CFSetApplyFunction(
            set_ref,
            collect_applier,
            &mut devices as *mut Vec<IOHIDDeviceRef> as *mut c_void,
        );
    }

    devices
}

/// Check if an accelerometer HID device is present (does not require root).
pub fn is_device_available() -> bool {
    unsafe {
        let manager = IOHIDManagerCreate(kCFAllocatorDefault, 0);
        if manager.is_null() {
            return false;
        }

        let matching = build_matching_dict();
        IOHIDManagerSetDeviceMatching(manager, matching.as_concrete_TypeRef().cast());

        let device_set = IOHIDManagerCopyDevices(manager);
        let has_devices = if device_set.is_null() {
            false
        } else {
            let count = CFSetGetCount(device_set);
            CFRelease(device_set.cast());
            count > 0
        };

        CFRelease(manager.cast());
        has_devices
    }
}

/// Context passed through the HID report callback.
pub struct StreamContext {
    pub callback: Box<dyn Fn(AccelSample) + Send>,
    pub sample_counter: std::sync::atomic::AtomicU64,
    pub report_buffer: [u8; REPORT_LENGTH],
}

/// A Send-safe wrapper for CFRunLoopRef, which is safe to stop from another thread.
pub struct SendableRunLoop(CFRunLoopRef);

// SAFETY: CFRunLoopStop is documented as thread-safe by Apple.
unsafe impl Send for SendableRunLoop {}
unsafe impl Sync for SendableRunLoop {}

impl SendableRunLoop {
    pub fn stop(&self) {
        unsafe { CFRunLoopStop(self.0) }
    }
}

/// Manages the IOKit HID manager lifecycle for accelerometer streaming.
pub struct HidStream {
    _manager: IOHIDManagerRef,
}

// SAFETY: HidStream fields are only used for cleanup on the same thread.
unsafe impl Send for HidStream {}

impl HidStream {
    /// Start streaming accelerometer data. Must be called from a dedicated thread.
    /// Returns a `SendableRunLoop` that can be used from another thread to stop the stream.
    /// This function blocks until the run loop is stopped.
    pub fn run_on_current_thread(
        callback: Box<dyn Fn(AccelSample) + Send>,
        run_loop_out: &std::sync::Arc<std::sync::Mutex<Option<SendableRunLoop>>>,
    ) -> Result<(), String> {
        unsafe {
            let manager = IOHIDManagerCreate(kCFAllocatorDefault, 0);
            if manager.is_null() {
                return Err("Failed to create IOHIDManager".into());
            }

            let matching = build_matching_dict();
            IOHIDManagerSetDeviceMatching(manager, matching.as_concrete_TypeRef().cast());

            let ret = IOHIDManagerOpen(manager, 0);
            if ret != 0 {
                CFRelease(manager.cast());
                return Err(format!(
                    "IOHIDManagerOpen failed with code {ret}. Root permission required."
                ));
            }

            let device_set_ref = IOHIDManagerCopyDevices(manager);
            if device_set_ref.is_null() {
                IOHIDManagerClose(manager, 0);
                CFRelease(manager.cast());
                return Err("No accelerometer device found".into());
            }

            let devices = collect_devices_from_set(device_set_ref);
            CFRelease(device_set_ref.cast());

            if devices.is_empty() {
                IOHIDManagerClose(manager, 0);
                CFRelease(manager.cast());
                return Err("No accelerometer device found".into());
            }

            // Create context on the heap — cleaned up after run loop exits
            let context = Box::into_raw(Box::new(StreamContext {
                callback,
                sample_counter: std::sync::atomic::AtomicU64::new(0),
                report_buffer: [0u8; REPORT_LENGTH],
            }));

            // Register callback for each matching device
            for &device in &devices {
                IOHIDDeviceRegisterInputReportCallback(
                    device,
                    &raw mut (*context).report_buffer as *mut u8,
                    REPORT_LENGTH as CFIndex,
                    hid_report_callback,
                    context.cast(),
                );
            }

            let run_loop = CFRunLoopGetCurrent();
            IOHIDManagerScheduleWithRunLoop(manager, run_loop, kCFRunLoopDefaultMode.cast());

            // Expose the run loop so another thread can stop it
            if let Ok(mut lock) = run_loop_out.lock() {
                *lock = Some(SendableRunLoop(run_loop));
            }

            // Block until CFRunLoopStop is called from another thread
            CFRunLoopRun();

            // Cleanup after run loop exits
            IOHIDManagerUnscheduleFromRunLoop(manager, run_loop, kCFRunLoopDefaultMode.cast());
            IOHIDManagerClose(manager, 0);
            CFRelease(manager.cast());
            drop(Box::from_raw(context));

            Ok(())
        }
    }
}

/// HID report callback — called at ~800Hz, downsamples to ~100Hz.
extern "C" fn hid_report_callback(
    context: *mut c_void,
    _result: IOReturn,
    _sender: IOHIDDeviceRef,
    _report_type: u32,
    _report_id: u32,
    report: *mut u8,
    report_length: CFIndex,
) {
    if context.is_null() || report.is_null() {
        return;
    }

    let ctx = unsafe { &*(context as *const StreamContext) };

    // Downsample: keep every 8th sample (~800Hz → ~100Hz)
    let count = ctx
        .sample_counter
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    if count % 8 != 0 {
        return;
    }

    let report_slice = unsafe { std::slice::from_raw_parts(report, report_length as usize) };

    if let Some(sample) = parse_report(report_slice) {
        (ctx.callback)(sample);
    }
}
