import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-5 w-1.5 rounded-sm bg-f1red" />
          <span className="text-lg font-bold tracking-tight">
            F1<span className="text-f1red">Live</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-zinc-400">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
