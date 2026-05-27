import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-zinc-400">
          <span className="live-dot h-2 w-2 rounded-full bg-f1red" />
          Real-time data viz
        </span>
        <h1 className="max-w-3xl text-balance text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          The Formula 1 race, <span className="text-f1red">live</span> on a screen.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-400">
          A live timing tower and animated track map driven by real OpenF1 data — with a
          speed-controlled replay so it&apos;s always in motion, plus AI race commentary.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-f1red px-6 py-3 font-semibold text-white shadow-lg shadow-f1red/20 transition hover:brightness-110"
          >
            Open Live Dashboard →
          </Link>
        </div>
        <div className="mt-14 grid max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {[
            ["Timing tower", "Positions, gaps, tyres, DRS and sectors that reorder in real time."],
            ["Track map", "Cars ease around a circuit traced from live GPS telemetry."],
            ["Replay clock", "Scrub and fast-forward any session at up to 30× speed."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-panel p-4">
              <div className="font-semibold">{title}</div>
              <div className="mt-1 text-sm text-zinc-400">{body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
