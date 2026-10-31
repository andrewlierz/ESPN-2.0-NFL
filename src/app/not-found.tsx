import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-line bg-card p-6 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-ink-2">We couldn&apos;t find that team, player or game.</p>
      <Link href="/" className="mt-4 inline-block rounded-md bg-nav px-4 py-2 text-sm font-semibold text-white">
        Back to home
      </Link>
    </div>
  );
}
