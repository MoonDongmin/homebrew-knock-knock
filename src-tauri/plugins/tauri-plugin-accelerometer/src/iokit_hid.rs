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
use core_foundation_sys::base::{CFAllocatorRef, CFIndex, CFTypeRef};
use core_foundation_sys::dictionary::CFDictionaryRef;
use core_foundation_sys::runloop::kCFRunLoopDefaultMode;
use core_foundation_sys::set::CFSetRef;
use core_foundation_sys::string::CFStringRef;
use std::ffi::{c_char, c_void};

// IOKit HID opaque types
pub type IOHIDManagerRef = *mut c_void;
pub type IOHIDDeviceRef = *mut c_void;
type IOOptionBits = u32;
type IOReturn = i32;

// IOKit service types
type MachPort = u32;
type IoIterator = u32;
type IoObject = u32;
type KernReturn = i32;
const KERN_SUCCESS: KernReturn = 0;

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
    fn IOHIDManagerRegisterInputReportCallback(
        manager: IOHIDManagerRef,
        callback: IOHIDReportCallback,
        context: *mut c_void,
    );
    fn IOHIDDeviceGetProperty(device: IOHIDDeviceRef, key: *const c_void) -> *const c_void;
}

// IOKit service registry functions (for waking SPU drivers)
#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOServiceMatching(name: *const c_char) -> CFDictionaryRef;
    fn IOServiceGetMatchingServices(
        main_port: MachPort,
        matching: CFDictionaryRef,
        existing: *mut IoIterator,
    ) -> KernReturn;
    fn IOIteratorNext(iterator: IoIterator) -> IoObject;
    fn IORegistryEntrySetCFProperty(
        entry: IoObject,
        property_name: CFStringRef,
        property: CFTypeRef,
    ) -> KernReturn;
    fn IOObjectRelease(object: IoObject) -> KernReturn;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFSetGetCount(set: CFSetRef) -> CFIndex;
    fn CFSetApplyFunction(set: CFSetRef, applier: CFSetApplierFunction, context: *mut c_void);
}

const USAGE_PAGE_VENDOR: i32 = 0xFF00;
const USAGE_ACCELEROMETER: i32 = 3;

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

/// Wake the SPU sensor drivers so they start generating HID reports.
/// Must be called before opening HID devices. Requires root permission.
pub fn wake_spu_drivers() -> Result<u32, String> {
    unsafe {
        let matching = IOServiceMatching(b"AppleSPUHIDDriver\0".as_ptr().cast());
        if matching.is_null() {
            return Err("IOServiceMatching(AppleSPUHIDDriver) returned null".into());
        }

        let mut iterator: IoIterator = 0;
        let ret = IOServiceGetMatchingServices(0, matching, &mut iterator);
        // Note: IOServiceGetMatchingServices consumes the matching dict
        if ret != KERN_SUCCESS {
            return Err(format!("IOServiceGetMatchingServices failed: {ret}"));
        }

        let key_reporting = CFString::new("SensorPropertyReportingState");
        let key_power = CFString::new("SensorPropertyPowerState");
        let key_interval = CFString::new("ReportInterval");
        let val_one = CFNumber::from(1i32);
        let val_interval = CFNumber::from(1000i32); // 1000 microseconds = 1kHz

        let mut count: u32 = 0;
        loop {
            let service = IOIteratorNext(iterator);
            if service == 0 {
                break;
            }

            IORegistryEntrySetCFProperty(
                service,
                key_reporting.as_concrete_TypeRef(),
                val_one.as_concrete_TypeRef().cast(),
            );
            IORegistryEntrySetCFProperty(
                service,
                key_power.as_concrete_TypeRef(),
                val_one.as_concrete_TypeRef().cast(),
            );
            IORegistryEntrySetCFProperty(
                service,
                key_interval.as_concrete_TypeRef(),
                val_interval.as_concrete_TypeRef().cast(),
            );

            IOObjectRelease(service);
            count += 1;
        }

        IOObjectRelease(iterator);
        eprintln!("[HID] Woke {count} AppleSPUHIDDriver service(s)");
        Ok(count)
    }
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
            // 0. Wake SPU sensor drivers (required for reports to flow)
            if let Err(e) = wake_spu_drivers() {
                eprintln!("[HID] Warning: failed to wake SPU drivers: {e}");
            }

            // 1. Create manager
            eprintln!("[HID] Creating IOHIDManager...");
            let manager = IOHIDManagerCreate(kCFAllocatorDefault, 0);
            if manager.is_null() {
                return Err("Failed to create IOHIDManager".into());
            }

            // 2. Set matching dictionary
            let matching = build_matching_dict();
            IOHIDManagerSetDeviceMatching(manager, matching.as_concrete_TypeRef().cast());

            // 3. Register input report callback on MANAGER (before schedule & open)
            let context = Box::into_raw(Box::new(StreamContext {
                callback,
                sample_counter: std::sync::atomic::AtomicU64::new(0),
            }));
            IOHIDManagerRegisterInputReportCallback(
                manager,
                hid_report_callback,
                context.cast(),
            );
            eprintln!("[HID] Manager-level input report callback registered");

            // 4. Schedule with run loop
            let run_loop = CFRunLoopGetCurrent();
            IOHIDManagerScheduleWithRunLoop(manager, run_loop, kCFRunLoopDefaultMode.cast());
            eprintln!("[HID] Manager scheduled with run loop");

            // 5. Open manager (opens all matched devices)
            eprintln!("[HID] Opening IOHIDManager...");
            let ret = IOHIDManagerOpen(manager, 0);
            if ret != 0 {
                IOHIDManagerUnscheduleFromRunLoop(manager, run_loop, kCFRunLoopDefaultMode.cast());
                CFRelease(manager.cast());
                drop(Box::from_raw(context));
                return Err(format!(
                    "IOHIDManagerOpen failed with code {ret}. Root permission required."
                ));
            }
            eprintln!("[HID] IOHIDManager opened successfully");

            // Log matched devices for diagnostics
            let device_set_ref = IOHIDManagerCopyDevices(manager);
            if !device_set_ref.is_null() {
                let devices = collect_devices_from_set(device_set_ref);
                eprintln!("[HID] Found {} matching device(s)", devices.len());
                let product_key = CFString::new("Product");
                for (i, &device) in devices.iter().enumerate() {
                    let name_ref = IOHIDDeviceGetProperty(device, product_key.as_concrete_TypeRef().cast());
                    let name = if name_ref.is_null() {
                        "<unknown>".to_string()
                    } else {
                        CFString::wrap_under_get_rule(name_ref as core_foundation::string::CFStringRef).to_string()
                    };
                    eprintln!("[HID] Device {i}: {name}");
                }
                CFRelease(device_set_ref.cast());
            }

            // Expose the run loop so another thread can stop it
            if let Ok(mut lock) = run_loop_out.lock() {
                *lock = Some(SendableRunLoop(run_loop));
            }

            // 6. Block until CFRunLoopStop is called from another thread
            eprintln!("[HID] CFRunLoopRun starting — waiting for HID reports...");
            CFRunLoopRun();
            eprintln!("[HID] CFRunLoopRun exited");

            // Cleanup
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

    if count == 0 {
        eprintln!("[HID] First HID report received (length={})", report_length);
    }

    if count % 8 != 0 {
        return;
    }

    let report_slice = unsafe { std::slice::from_raw_parts(report, report_length as usize) };

    if let Some(sample) = parse_report(report_slice) {
        (ctx.callback)(sample);
    } else if count < 80 {
        eprintln!("[HID] Failed to parse report (length={}, count={})", report_length, count);
    }
}
