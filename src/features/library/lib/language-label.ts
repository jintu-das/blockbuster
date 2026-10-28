const languageNames = new Intl.DisplayNames(undefined, { type: "language" });

/** "English" for "eng" or "en", "Portuguese (Brazil)" for "pt-BR"; the raw code when the runtime has no name for it. */
export function languageLabel(code: string) {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}
