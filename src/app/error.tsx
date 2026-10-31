"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-line bg-card p-6 text-center">
      <h1 className="text-xl font-bold">Couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-ink-2">
        The stats source may be temporarily unreachable. {error.digest ? `(ref ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-nav px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
