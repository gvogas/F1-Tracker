"use client";

interface Props {
  text: string;
  ai: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export function AICommentaryPanel({ text, ai, loading, error, onRetry }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          <span className="text-f1red">◆</span> AI Commentary
          {ai && (
            <span className="rounded bg-f1red/20 px-1.5 py-0.5 text-[10px] text-f1red">LIVE</span>
          )}
        </h3>
        <button
          onClick={onRetry}
          disabled={loading}
          className="text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-zinc-500">
          Couldn&apos;t load commentary.{" "}
          <button onClick={onRetry} className="text-f1red underline">
            Retry
          </button>
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-zinc-300">
          {text || "Waiting for on-track action…"}
        </p>
      )}
    </div>
  );
}
