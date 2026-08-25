#![cfg(windows)]

use rcl_tensor_engine::{CAPABILITY, PROVIDER_ID, execute_json};
use std::ffi::{CStr, CString, c_char, c_void};
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::{ffi::OsStr, fs, mem, ptr};

type HModule = *mut c_void;
type RclVmInstance = c_void;

type ProviderInvoke = unsafe extern "C" fn(
    *mut c_void,
    *const c_char,
    *const c_char,
    *mut c_char,
    usize,
    *mut c_char,
    usize,
) -> i32;

#[repr(C)]
struct RclVmProviderV1 {
    abi_version: u32,
    provider_id: *const c_char,
    invoke: Option<ProviderInvoke>,
    userdata: *mut c_void,
}

type InstanceCreate = unsafe extern "C" fn() -> *mut RclVmInstance;
type InstanceDestroy = unsafe extern "C" fn(*mut RclVmInstance);
type InstanceLoadFile =
    unsafe extern "C" fn(*mut RclVmInstance, *const c_char, *mut c_char, usize) -> i32;
type InstanceRegisterProvider =
    unsafe extern "C" fn(*mut RclVmInstance, *const RclVmProviderV1, *mut c_char, usize) -> i32;
type InstanceRun =
    unsafe extern "C" fn(*mut RclVmInstance, i32, *mut *mut c_char, *mut c_char, usize) -> i32;
type FreeString = unsafe extern "C" fn(*mut c_char);

unsafe extern "system" {
    fn LoadLibraryW(path: *const u16) -> HModule;
    fn GetProcAddress(module: HModule, name: *const c_char) -> *mut c_void;
    fn FreeLibrary(module: HModule) -> i32;
}

unsafe fn symbol<T: Copy>(module: HModule, name: &str) -> Result<T, String> {
    let name = CString::new(name).unwrap();
    let address = unsafe { GetProcAddress(module, name.as_ptr()) };
    if address.is_null() {
        return Err(format!(
            "rclvm.dll does not export {}",
            name.to_string_lossy()
        ));
    }
    Ok(unsafe { mem::transmute_copy(&address) })
}

fn write_c_buffer(destination: *mut c_char, capacity: usize, value: &str) -> bool {
    if destination.is_null() || capacity == 0 || value.len() + 1 > capacity {
        return false;
    }
    unsafe {
        ptr::copy_nonoverlapping(value.as_ptr(), destination.cast::<u8>(), value.len());
        *destination.add(value.len()) = 0;
    }
    true
}

unsafe extern "C" fn invoke(
    _userdata: *mut c_void,
    capability: *const c_char,
    request_json: *const c_char,
    response_json: *mut c_char,
    response_capacity: usize,
    error: *mut c_char,
    error_capacity: usize,
) -> i32 {
    let capability = unsafe { CStr::from_ptr(capability) }.to_string_lossy();
    if capability != CAPABILITY {
        write_c_buffer(
            error,
            error_capacity,
            &format!("RCL_TENSOR_CAPABILITY_UNSUPPORTED: {capability}"),
        );
        return 0;
    }
    let request = unsafe { CStr::from_ptr(request_json) }.to_string_lossy();
    match execute_json(&request) {
        Ok(response) if write_c_buffer(response_json, response_capacity, &response) => 1,
        Ok(_) => {
            write_c_buffer(error, error_capacity, "RCL_TENSOR_RESPONSE_CAPACITY");
            0
        }
        Err(message) => {
            write_c_buffer(error, error_capacity, &message);
            0
        }
    }
}

fn wide(path: &Path) -> Vec<u16> {
    OsStr::new(path.as_os_str())
        .encode_wide()
        .chain(Some(0))
        .collect()
}

fn c_path(path: &Path) -> Result<CString, String> {
    CString::new(path.to_string_lossy().as_bytes())
        .map_err(|_| "Path contains an interior NUL".into())
}

pub fn run_rbc(rbc_path: &Path, dll_path: &Path) -> Result<String, String> {
    if !rbc_path.is_file() {
        return Err(format!("RBC file does not exist: {}", rbc_path.display()));
    }
    if !dll_path.is_file() {
        return Err(format!("rclvm.dll does not exist: {}", dll_path.display()));
    }
    let module = unsafe { LoadLibraryW(wide(dll_path).as_ptr()) };
    if module.is_null() {
        return Err(format!("Unable to load {}", dll_path.display()));
    }
    let outcome = unsafe {
        let create: InstanceCreate = symbol(module, "rclvm_instance_create")?;
        let destroy: InstanceDestroy = symbol(module, "rclvm_instance_destroy")?;
        let load_file: InstanceLoadFile = symbol(module, "rclvm_instance_load_file")?;
        let register_provider: InstanceRegisterProvider =
            symbol(module, "rclvm_instance_register_provider")?;
        let run: InstanceRun = symbol(module, "rclvm_instance_run")?;
        let free_string: FreeString = symbol(module, "rclvm_free_string")?;
        let instance = create();
        if instance.is_null() {
            return Err("rclvm_instance_create returned null".into());
        }
        let mut error = vec![0i8; 2048];
        let provider_id = CString::new(PROVIDER_ID).unwrap();
        let provider = RclVmProviderV1 {
            abi_version: 1,
            provider_id: provider_id.as_ptr(),
            invoke: Some(invoke),
            userdata: ptr::null_mut(),
        };
        let mut result_json: *mut c_char = ptr::null_mut();
        let result = (|| {
            if register_provider(instance, &provider, error.as_mut_ptr(), error.len()) == 0 {
                return Err(CStr::from_ptr(error.as_ptr())
                    .to_string_lossy()
                    .into_owned());
            }
            let path = c_path(rbc_path)?;
            if load_file(instance, path.as_ptr(), error.as_mut_ptr(), error.len()) == 0 {
                return Err(CStr::from_ptr(error.as_ptr())
                    .to_string_lossy()
                    .into_owned());
            }
            if run(
                instance,
                1,
                &mut result_json,
                error.as_mut_ptr(),
                error.len(),
            ) == 0
            {
                return Err(CStr::from_ptr(error.as_ptr())
                    .to_string_lossy()
                    .into_owned());
            }
            let text = CStr::from_ptr(result_json).to_string_lossy().into_owned();
            free_string(result_json);
            Ok(text)
        })();
        destroy(instance);
        result
    };
    unsafe {
        FreeLibrary(module);
    }
    outcome
}

pub fn default_dll_path() -> Result<std::path::PathBuf, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    for ancestor in executable.ancestors() {
        let candidate = ancestor.join("native").join("rclvm.dll");
        if candidate.is_file() {
            return fs::canonicalize(candidate).map_err(|error| error.to_string());
        }
        let sibling = ancestor.join("rclvm.dll");
        if sibling.is_file() {
            return fs::canonicalize(sibling).map_err(|error| error.to_string());
        }
    }
    let cwd_candidate = std::env::current_dir()
        .map_err(|error| error.to_string())?
        .join("native")
        .join("rclvm.dll");
    if cwd_candidate.is_file() {
        Ok(cwd_candidate)
    } else {
        Err("Could not locate native/rclvm.dll; pass it explicitly".into())
    }
}
