import { UsersIcon } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/** OMDb lists lead actors by name only, without characters or photos. */
export function MovieCast({ actors }: { actors: string[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
        <UsersIcon className="size-4 text-primary" />
        Starring
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {actors.map((actor) => (
          <li
            key={actor}
            className="flex flex-col items-center gap-2 rounded-xl bg-card p-3 text-center ring-1 ring-foreground/10"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-muted font-heading text-lg font-semibold text-muted-foreground">
              {initials(actor)}
            </span>
            <span className="line-clamp-1 text-sm font-semibold">{actor}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
