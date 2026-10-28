mod db;
mod library;
mod media;
mod player;

use std::sync::Mutex;

use library::commands::{self, Db, ScanLock};
use player::commands::Player;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // The catalog lives in the app data directory; media files are only ever read.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("blockbuster.db"))?;
            app.manage(Db(Mutex::new(conn)));
            app.manage(ScanLock::default());
            app.manage(Player::default());
            // Generated thumbnails go next to the catalog. Posters need an OMDb key.
            let omdb_api_key = std::env::var("OMDB_API_KEY").ok();
            app.manage(media::Enrichment::new(data_dir.join("thumbnails"), omdb_api_key));
            // Backfill movies scanned before metadata existed, or whose last pass was cut short.
            // The UI rescans the folder on launch, which queues another pass if anything changed.
            media::spawn(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library_folder,
            commands::set_library_folder,
            commands::scan_library,
            commands::list_movies,
            commands::get_movie_details,
            commands::get_thumbnail,
            player::commands::play_movie,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        // Stop mpv on quit so the position of a movie still playing is saved.
        if let RunEvent::Exit = event {
            player::commands::shutdown(app);
        }
    });
}
