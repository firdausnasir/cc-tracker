"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  FileTextIcon,
  Loader2Icon,
  SparklesIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";

import { StatementForm } from "@/components/statement-form";
import { createStatementAction } from "@/app/actions/statements";
import { extractStatementAction, type ImportState } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CardOption = { id: string; name: string; issuer: string | null };

// Mirror the server ceiling (src/app/actions/import.ts) so we can give instant
// feedback. The server stays the source of truth.
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export function ImportStatementDialog({ cards }: { cards: CardOption[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 active:scale-[0.97]">
            <SparklesIcon className="size-4" />
            Import PDF
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {/* The body is portaled and unmounts on close, so the extract action
            state resets cleanly between opens. */}
        <ImportFlow cards={cards} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportFlow({
  cards,
  onDone,
}: {
  cards: CardOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    extractStatementAction,
    null,
  );

  const draft = state && "draft" in state ? state.draft : null;
  const error = state && "error" in state ? state.error : null;

  if (draft) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Review extracted statement</DialogTitle>
          <DialogDescription>
            Check the figures below before saving — the AI can misread. Dates come
            from the card&apos;s schedule.
          </DialogDescription>
        </DialogHeader>

        {!draft.amount && (
          <Notice>The amount couldn&apos;t be read — enter it manually.</Notice>
        )}
        {draft.currency && (
          <p className="text-xs text-muted-foreground">
            Detected currency{" "}
            <span className="font-medium text-foreground">{draft.currency}</span>.
            The statement uses its card&apos;s currency — pick a matching card.
          </p>
        )}

        <StatementForm
          action={createStatementAction}
          cards={cards}
          defaultCardId={draft.cardId ?? undefined}
          defaultMonth={draft.month ?? undefined}
          defaultAmount={draft.amount ?? undefined}
          submitLabel="Save statement"
          pendingLabel="Saving…"
          onSuccess={onDone}
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import a statement from PDF</DialogTitle>
        <DialogDescription>
          Upload a statement PDF and the AI will read the balance, cycle and card
          for you to confirm.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pdf">Statement PDF</Label>
          <Dropzone disabled={pending} />
        </div>

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="w-full gap-1.5 active:scale-[0.98]"
        >
          {pending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Reading…
            </>
          ) : (
            <>
              <SparklesIcon className="size-4" />
              Extract statement
            </>
          )}
        </Button>
      </form>
    </>
  );
}

function Dropzone({ disabled }: { disabled: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);

  // Reflect a programmatic file (drag-drop) onto the real input so the form
  // submits it. DataTransfer keeps native required-validation happy too.
  function commit(next: File | null) {
    const input = inputRef.current;
    if (!input) return;

    if (next) {
      const dt = new DataTransfer();
      dt.items.add(next);
      input.files = dt.files;
    } else {
      input.value = "";
    }

    setFile(next);
  }

  // Client-side guard mirroring the server. Returns an error string or null.
  function validate(candidate: File): string | null {
    if (candidate.type !== "application/pdf") return "That isn’t a PDF file.";
    if (candidate.size > MAX_PDF_BYTES) return "That PDF is too large (max 8 MB).";
    return null;
  }

  function accept(candidate: File | undefined | null) {
    if (!candidate) return;
    const problem = validate(candidate);
    if (problem) {
      setHint(problem);
      commit(null);
      return;
    }
    setHint(null);
    commit(candidate);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "group relative flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-muted/30 px-6 py-7 text-center transition-all",
          "hover:border-primary/50 hover:bg-primary/5",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          dragging && "scale-[1.01] border-primary bg-primary/10",
          disabled && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        {/* The real input fills the zone (when empty) so the whole area is a
            clickable, keyboard-focusable file picker. Field contract preserved:
            name="pdf", accept, required, disabled. */}
        <input
          ref={inputRef}
          id="pdf"
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          disabled={disabled}
          onChange={(e) => accept(e.target.files?.[0])}
          className={cn(
            "absolute inset-0 cursor-pointer opacity-0",
            file && "pointer-events-none",
          )}
        />

        {file ? (
          <div className="flex w-full items-center gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileTextIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {file.name}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatBytes(file.size)}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onClick={() => {
                setHint(null);
                commit(null);
                inputRef.current?.focus();
              }}
              aria-label="Remove file"
              className="relative z-10 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform",
                "group-hover:scale-105",
                dragging && "scale-110",
              )}
            >
              <UploadCloudIcon className="size-5" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Drop your statement PDF here
              </span>
              <span className="text-xs text-muted-foreground">
                or <span className="text-primary underline-offset-2">click to browse</span>
              </span>
            </span>
          </>
        )}
      </div>

      <p
        className={cn(
          "flex items-center gap-1.5 px-0.5 text-xs",
          hint ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {hint && <TriangleAlertIcon className="size-3.5 shrink-0" />}
        {hint ?? "PDF · up to 8 MB"}
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
