/** The radio value for "let mpv decide"; it is stored as no choice at all. */
export const AUTO_CHOICE = "auto";

/** Choice values as the backend stores them (`store::Choice`). */
export const subtitleChoice = {
  off: "off",
  embedded: (index: number) => `embedded:${index}`,
  sidecar: (fileName: string) => `sidecar:${fileName}`,
  added: (id: number) => `added:${id}`,
};

/** The stored choice for a radio value. */
export function toStoredChoice(value: string) {
  return value === AUTO_CHOICE ? undefined : value;
}
