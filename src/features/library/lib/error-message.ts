/** Tauri commands reject with a plain string; other failures are Error objects. */
export function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
