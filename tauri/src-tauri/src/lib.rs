use once_cell::sync::OnceCell;
use std::io::{BufRead, BufReader};
use std::net::{SocketAddr, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

/// Prefer a stable loopback port so the UI default and Tauri invoke agree.
const PREFERRED_SIDECAR_ADDR: &str = "127.0.0.1:7420";

static SIDECAR_URL: OnceCell<Mutex<String>> = OnceCell::new();
static SIDECAR_CHILD: OnceCell<Mutex<Option<Child>>> = OnceCell::new();

#[tauri::command]
fn sidecar_url() -> String {
    SIDECAR_URL
        .get()
        .and_then(|m| m.lock().ok())
        .map(|g| g.clone())
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| format!("http://{PREFERRED_SIDECAR_ADDR}"))
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
    let triple = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    let triple_name = match (os, triple) {
        ("macos", "aarch64") => "deckhand-sidecar-aarch64-apple-darwin",
        ("macos", "x86_64") => "deckhand-sidecar-x86_64-apple-darwin",
        ("linux", "x86_64") => "deckhand-sidecar-x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "deckhand-sidecar-aarch64-unknown-linux-gnu",
        _ => "deckhand-sidecar",
    };
    let p = std::path::PathBuf::from(manifest_dir)
        .join("binaries")
        .join(triple_name);
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

fn sidecar_port_open(addr: &str) -> bool {
    let Ok(sock) = addr.parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&sock, Duration::from_millis(200)).is_ok()
}

fn spawn_sidecar_at(bin: &std::path::Path, addr: &str) -> Result<(Child, String), String> {
    let mut child = Command::new(bin)
        .args(["--addr", addr])
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("spawn {}: {e}", bin.display()))?;

    let stdout = child.stdout.take().ok_or("no sidecar stdout")?;
    let mut reader = BufReader::new(stdout);
    let mut url = format!("http://{addr}");
    let mut line = String::new();
    for _ in 0..40 {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                if let Some(bound) = line.trim().strip_prefix("DECKHAND_SIDECAR_ADDR=") {
                    url = format!("http://{bound}");
                    break;
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    // Drain remaining stdout so the child cannot block on a full pipe.
    thread::spawn(move || {
        let mut sink = String::new();
        while reader.read_line(&mut sink).ok().filter(|n| *n > 0).is_some() {
            sink.clear();
        }
    });

    // Brief grace period — bind failures usually surface immediately.
    thread::sleep(Duration::from_millis(80));
    if let Ok(Some(status)) = child.try_wait() {
        return Err(format!("sidecar exited early: {status}"));
    }

    Ok((child, url))
}

fn spawn_sidecar() -> Result<(), String> {
    let preferred = format!("http://{PREFERRED_SIDECAR_ADDR}");
    // Reuse an already-running local sidecar (browser split-dev, prior launch).
    if sidecar_port_open(PREFERRED_SIDECAR_ADDR) {
        set_url(preferred);
        return Ok(());
    }

    let bin =
        find_sidecar_binary().ok_or("sidecar binary not found — run: bun run build:sidecar")?;

    let (child, url) = match spawn_sidecar_at(&bin, PREFERRED_SIDECAR_ADDR) {
        Ok(v) => v,
        Err(err) => {
            eprintln!("sidecar bind {PREFERRED_SIDECAR_ADDR} failed ({err}); trying ephemeral port");
            spawn_sidecar_at(&bin, "127.0.0.1:0")?
        }
    };

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
    // Resolve URL before the webview boots so the first invoke is never empty.
    if let Err(err) = spawn_sidecar() {
        eprintln!("sidecar spawn warning: {err}");
        set_url(format!("http://{PREFERRED_SIDECAR_ADDR}"));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![sidecar_url])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open Deckhand", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Deckhand")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        kill_sidecar();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Keep running in tray on macOS/Linux desktop
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Deckhand")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                kill_sidecar();
            }
        });
}
