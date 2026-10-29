import { type ErrorComponentProps, Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronRightIcon, CopyIcon, HouseIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";

// SMPTE color bars, the "no signal" test card, faded behind the message.
const colorBars = [
  "bg-zinc-300",
  "bg-yellow-400",
  "bg-cyan-400",
  "bg-green-500",
  "bg-fuchsia-500",
  "bg-red-500",
  "bg-blue-600",
];

const SPROCKET_COUNT = 40;

function Sprockets({ className }: { className: string }) {
  return (
    <div aria-hidden className={`absolute inset-x-0 flex justify-between gap-3 overflow-hidden px-3 ${className}`}>
      {Array.from({ length: SPROCKET_COUNT }, (_, index) => (
        <span key={index} className="h-2.5 w-4 shrink-0 rounded-[3px] bg-foreground/10" />
      ))}
    </div>
  );
}

/** Fallback for a route that crashed while rendering. Shown inside the app shell, so navigation still works. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const path = useLocation({ select: (location) => location.href });
  const message = errorMessage(error);
  // Stacks help while developing; a release build shows only the message.
  const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
  const report = [`Path: ${path}`, `Error: ${message}`, stack].filter(Boolean).join("\n\n");

  const copyReport = () =>
    navigator.clipboard.writeText(report).then(
      () => toast.add({ title: "Error details copied", type: "success" }),
      () => toast.add({ title: "Couldn't copy the error details", type: "error" }),
    );

  return (
    <section
      role="alert"
      className="relative isolate flex flex-1 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div aria-hidden className="absolute inset-0 -z-10 flex opacity-40 saturate-150">
        {colorBars.map((color) => (
          <div key={color} className={`flex-1 ${color}`} />
        ))}
      </div>
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-card via-card/80 to-card/30" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-card via-card/80 to-transparent" />
      <Sprockets className="top-3" />
      <Sprockets className="bottom-3" />

      <div className="flex min-h-[420px] w-full max-w-2xl flex-col justify-center gap-6 px-6 py-14 lg:px-10">
        <Badge variant="destructive" className="font-mono tracking-wider uppercase">
          <TriangleAlertIcon data-icon="inline-start" />
          Projection halted
        </Badge>

        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
            The film snapped.
          </h1>
          <p className="max-w-lg text-pretty text-muted-foreground">
            Something on this page broke while it was loading. Your library, watch progress and subtitles are safe.
            Try again, or head somewhere else.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RotateCwIcon data-icon="inline-start" />
            Try again
          </Button>
          {canGoBack && (
            <Button variant="outline" onClick={() => router.history.back()}>
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
          )}
          <Link to="/" className={buttonVariants({ variant: "ghost" })}>
            <HouseIcon data-icon="inline-start" />
            Home
          </Link>
        </div>

        <details className="group rounded-lg bg-muted/60 ring-1 ring-foreground/10 backdrop-blur-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            Technical details
          </summary>
          <div className="flex flex-col gap-3 border-t border-foreground/10 p-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">Path</dt>
              <dd className="break-all">{path}</dd>
              <dt className="text-muted-foreground">Error</dt>
              <dd className="break-words text-destructive">{message}</dd>
            </dl>
            {stack && (
              <pre className="max-h-48 overflow-auto rounded-md bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {stack}
              </pre>
            )}
            <Button variant="outline" size="sm" className="self-start" onClick={copyReport}>
              <CopyIcon data-icon="inline-start" />
              Copy details
            </Button>
          </div>
        </details>
      </div>
    </section>
  );
}
