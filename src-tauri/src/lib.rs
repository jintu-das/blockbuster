mod db;
mod library;

use std::sync::Mutex;

use library::commands::{self, Db, ScanLock};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // The catalog lives in the app data directory; media files are only ever read.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("blockbuster.db"))?;
            app.manage(Db(Mutex::new(conn)));
            app.manage(ScanLock::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library_folder,
            commands::set_library_folder,
            commands::scan_library,
            commands::list_movies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
