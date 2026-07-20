use once_cell::sync::OnceCell;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

static SIDECAR_URL: OnceCell<Mutex<String>> = OnceCell::new();
static SIDECAR_CHILD: OnceCell<Mutex<Option<Child>>> = OnceCell::new();

#[tauri::command]
fn sidecar_url() -> String {
    SIDECAR_URL
        .get()
        .and_then(|m| m.lock().ok())
        .map(|g| g.clone())
        .unwrap_or_else(|| "http://127.0.0.1:7420".into())
}

fn set_url(url: String) {
    let cell = SIDECAR_URL.get_or_init(|| Mutex::new(String::new()));
    if let Ok(mut g) = cell.lock() {
        *g = url;
    }
}

fn find_sidecar_binary() -> Option<std::path::PathBuf> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let candidates = [
        format!("{manifest_dir}/binaries/deckhand-sidecar"),
        format!("{manifest_dir}/../../sidecar/deckhand-sidecar"),
        format!("{manifest_dir}/../sidecar/deckhand-sidecar"),
    ];
    for c in candidates {
        let p = std::path::PathBuf::from(&c);
        if p.exists() {
            return Some(p);
        }
    }
    // Triple-suffixed externalBin names used by Tauri bundling
    let triple = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    let triple_name = match (os, triple) {
        ("macos", "aarch64") => "deckhand-sidecar-aarch64-apple-darwin",
        ("macos", "x86_64") => "deckhand-sidecar-x86_64-apple-darwin",
        ("linux", "x86_64") => "deckhand-sidecar-x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "deckhand-sidecar-aarch64-unknown-linux-gnu",
        _ => "deckhand-sidecar",
    };
    let p = std::path::PathBuf::from(manifest_dir).join("binaries").join(triple_name);
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

fn spawn_sidecar() -> Result<(), String> {
    let bin = find_sidecar_binary().ok_or("sidecar binary not found — run: bun run build:sidecar")?;
    let mut child = Command::new(&bin)
        .args(["--addr", "127.0.0.1:0"])
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("spawn {}: {e}", bin.display()))?;

    let stdout = child.stdout.take().ok_or("no sidecar stdout")?;
    let mut url = String::from("http://127.0.0.1:7420");
    for line in BufReader::new(stdout).lines().take(30) {
        let line = line.map_err(|e| e.to_string())?;
        if let Some(addr) = line.strip_prefix("DECKHAND_SIDECAR_ADDR=") {
            url = format!("http://{addr}");
            break;
        }
    }
    set_url(url);

    SIDECAR_CHILD
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|e| e.to_string())?
        .replace(child);
    Ok(())
}

fn kill_sidecar() {
    if let Some(cell) = SIDECAR_CHILD.get() {
        if let Ok(mut guard) = cell.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![sidecar_url])
        .setup(|_app| {
            if let Err(err) = spawn_sidecar() {
                eprintln!("sidecar spawn warning: {err}");
                set_url("http://127.0.0.1:7420".into());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Deckhand")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                kill_sidecar();
            }
        });
}
