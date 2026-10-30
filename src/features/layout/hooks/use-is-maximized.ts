import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

/**
 * Whether the window is maximized. It also changes outside the app's buttons (double-clicking
 * the header, keyboard shortcuts, snapping), so it follows the window's resize events.
 */
export function useIsMaximized() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const update = () => appWindow.isMaximized().then(setIsMaximized);
    update();
    const unlisten = appWindow.onResized(update);
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  return isMaximized;
}
