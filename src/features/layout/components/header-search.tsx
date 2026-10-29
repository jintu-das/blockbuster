import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { useMovieSearch } from "../hooks/use-movie-search";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** The header's movie title search. Ctrl+K (⌘K on a Mac) focuses it from anywhere. */
export function HeaderSearch() {
  const { query, search } = useMovieSearch();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(isMac ? event.metaKey : event.ctrlKey)) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <InputGroup className="max-w-md">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
        type="search"
        placeholder="Search movies..."
        aria-label="Search movies"
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        value={query}
        onChange={(event) => search(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          // First Escape clears the search; the next one leaves the box.
          if (query) search("");
          else event.currentTarget.blur();
          event.preventDefault();
        }}
      />
      {query && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => search("")}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
      <InputGroupAddon align="inline-end">
        <Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
      </InputGroupAddon>
    </InputGroup>
  );
}
