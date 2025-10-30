"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type Place = 1 | 2 | 3;

interface ApiRow {
  username: string;
  wagered: number;
}
interface ApiPayload {
  updated_at_utc: string;
  range: { start_at: string; end_at: string };
  count: number;
  rows: ApiRow[];
}

interface Entry {
  rank: number;
  user: string;
  avatar: string;
  wagered: number;
  prize: number;
}

/* ---------- Utility ---------- */
const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PRIZES: Record<number, number> = {
  1: 4000,
  2: 2500,
  3: 1500,
  4: 600,
  5: 400,
  6: 300,
  7: 250,
  8: 200,
  9: 150,
  10: 100,
};


const SEASON_END = new Date("2025-10-31T23:59:59Z");

/* ---------- Hooks ---------- */
function useCountdown(targetDate: Date) {
  const [diff, setDiff] = useState(() => Math.max(0, targetDate.getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setDiff(Math.max(0, targetDate.getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

/* ---------- Data fetch ---------- */
function useLeaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [meta, setMeta] = useState<{ updated?: string; range?: { start_at: string; end_at: string } }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const res = await fetch("/leaderboard.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ApiPayload;

        // take top 10 (sorted in the script already)
        const rows = (data.rows || []).slice(0, 10);

        const mapped: Entry[] = rows.map((r, i) => {
          const rank = i + 1;
          const user = r.username ?? "unknown";
          return {
            rank,
            user,
            avatar: "/avatar.png",
            wagered: r.wagered ?? 0,
            prize: PRIZES[rank] ?? 0,
          };
        });

        if (!cancelled) {
          setEntries(mapped);
          setMeta({ updated: data.updated_at_utc, range: data.range });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load leaderboard");
      }
    }

    load();
    // If you want auto-refresh in browser, uncomment:
    // const t = setInterval(load, 60_000);
    // return () => { cancelled = true; clearInterval(t); };
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, meta, error };
}

/* ---------- Components ---------- */

const Shine = () => (
  <div className="pointer-events-none absolute inset-0 rounded-3xl [mask-image:radial-gradient(80%_80%_at_20%_0%,#000_0%,transparent_70%)]">
    <div className="absolute -top-32 left-10 h-64 w-64 rotate-12 rounded-full blur-3xl opacity-30 bg-gradient-to-br from-rose-400/40 via-red-400/30 to-amber-400/30" />
  </div>
);

function GridBackground() {
  return (
    <div
      className="
        absolute inset-0
        [background-image:
          repeating-linear-gradient(0deg,rgba(255,255,255,.05)_0_1px,transparent_1px_32px),
          repeating-linear-gradient(90deg,rgba(255,255,255,.05)_0_1px,transparent_1px_32px),
          repeating-linear-gradient(0deg,rgba(255,255,255,.1)_0_1px,transparent_1px_128px),
          repeating-linear-gradient(90deg,rgba(255,255,255,.1)_0_1px,transparent_1px_128px)
        ]
      "
    />
  );
}

function FloatingGlow() {
  return (
    <motion.div
      aria-hidden
      className="absolute left-1/2 top-[-20%] h-[50rem] w-[50rem] -translate-x-1/2 rounded-full blur-3xl opacity-30 bg-gradient-radial from-rose-500/10 via-amber-500/10 to-transparent"
      animate={{ x: ["-8%", "8%", "-8%"], y: ["0%", "10%", "0%"], rotate: [0, 12, -6, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-rose-400/20 bg-[rgba(10,10,10,.7)] backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-400/40 via-red-400/40 to-amber-400/40 ring-1 ring-white/10 shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5 text-white">
              <path fill="currentColor" d="M7 10l5-8l5 8l-5 3zM4 13l8 5l8-5l-8 9z" />
            </svg>
          </div>
          <span className="truncate whitespace-nowrap text-base sm:text-lg font-bold tracking-tight text-white">
            aura<strong className="text-rose-400">rewards</strong>.com
          </span>
        </div>
        <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <a
            className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm text-white transition hover:border-rose-400/40 hover:bg-rose-400/20 whitespace-nowrap"
            href="#leaderboard"
          >
            Leaderboard
          </a>
          <a
            className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm text-neutral-300 transition hover:border-white/30 hover:bg-white/[.06] whitespace-nowrap shrink-0"
            href="https://rainbet.com/?r=clip"
            target="_blank"
            rel="noreferrer"
          >
            rainbet.com
          </a>
        </nav>
      </div>
    </header>
  );
}


function Podium({ place, entry }: { place: Place; entry: Entry }) {
  const colors: Record<Place, string> = {
    1: "from-yellow-400 via-amber-300 to-yellow-500",
    2: "from-zinc-400 via-neutral-300 to-zinc-500",
    3: "from-orange-400 via-amber-300 to-orange-500",
  };
  const heights: Record<Place, string> = { 1: "h-72", 2: "h-56", 3: "h-48" };
  const tilt: Record<Place, string> = { 1: "", 2: "-rotate-2", 3: "rotate-2" };
  const glow: Record<Place, string> = {
    1: "shadow-[0_0_80px_-20px_rgba(250,204,21,.5)]",
    2: "shadow-[0_0_60px_-16px_rgba(244,244,245,.3)]",
    3: "shadow-[0_0_60px_-16px_rgba(251,146,60,.4)]",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: place * 0.1 }}
      className={`relative flex w-full max-w-[18rem] ${heights[place]} items-end justify-center`}
    >
      <div
        className={`relative w-full ${heights[place]} ${tilt[place]} rounded-2xl bg-gradient-to-br ${colors[place]} p-0.5 ${glow[place]} transition-transform duration-300 hover:-translate-y-1`}
      >
        <div className="relative flex h-full w-full flex-col items-center justify-end rounded-[1rem] bg-neutral-900/95 p-4">
          <div className="absolute -top-10">
            <div className="relative">
              <img src={entry.avatar} alt={entry.user} className="h-16 w-16 rounded-full border border-white/10 shadow-lg" />
              <div className="absolute -right-2 -bottom-2 grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-sm font-black text-white ring-2 ring-white/10">
                {place}
              </div>
            </div>
          </div>
          <div className="mt-8 text-center">
            <h3 className="text-xl font-semibold tracking-tight text-rose-200">{entry.user}</h3>
            <p className="mt-1 text-sm text-neutral-400">Wagered {fmt.format(entry.wagered)}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-300">
              🏆 Prize {fmt.format(entry.prize)}
            </p>
          </div>
          <Shine />
        </div>
      </div>
    </motion.div>
  );
}

function RankRow({ entry }: { entry: Entry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.25 }}
      className="group relative grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-xl border border-white/5 bg-white/[.02] px-4 py-3 backdrop-blur-sm transition hover:bg-red-500/5"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-900 text-sm font-bold text-white/80 ring-1 ring-white/10">
        {entry.rank}
      </div>
      <div className="flex items-center gap-3">
        <img src={entry.avatar} alt="avatar" className="h-10 w-10 rounded-full ring-1 ring-white/10" />
        <div>
          <div className="font-medium text-rose-200">{entry.user}</div>
          <div className="text-xs text-neutral-400">Prize {fmt.format(entry.prize)}</div>
        </div>
      </div>
      <div className="justify-self-end text-sm text-neutral-400">Wagered</div>
      <div className="justify-self-end text-base font-semibold tracking-tight text-amber-300">{fmt.format(entry.wagered)}</div>
    </motion.div>
  );
}

function Countdown({ end }: any) {
  const { days, hours, minutes, seconds } = useCountdown(end);
  const pad = (n: number) => String(n).padStart(2, "0");
  const items = useMemo(
    () => [
      { label: "Days", value: pad(days) },
      { label: "Hours", value: pad(hours) },
      { label: "Minutes", value: pad(minutes) },
      { label: "Seconds", value: pad(seconds) },
    ],
    [days, hours, minutes, seconds]
  );
  return (
    <div className="flex items-center gap-2">
      {items.map((t, i) => (
        <div
          key={i}
          className="grid w-20 grid-rows-[1fr_auto] rounded-xl border border-red-500/30 bg-neutral-900/70 p-2 text-center shadow-lg backdrop-blur"
        >
          <div className="text-2xl font-black text-rose-300 tabular-nums">{t.value}</div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-400">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export default function AuraRewards() {
  const { entries, meta, error } = useLeaderboard();

  const top3 = entries?.slice(0, 3) ?? [];
  const rest = entries?.slice(3, 10) ?? [];

  return (
    <>
      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GridBackground />
        <FloatingGlow />
        <div className="absolute inset-0 opacity-[.06] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:6px_6px]" />
        <div className="absolute inset-0 [background:radial-gradient(80%_80%_at_50%_20%,transparent,rgba(0,0,0,.35))]" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 min-h-screen bg-neutral-950 text-white">
        <NavBar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-10" id="leaderboard">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent md:text-5xl">
              Affiliate Leaderboard
            </h1>
            <p className="mt-4 text-neutral-300">
              Every <span className="font-semibold text-rose-300">$</span> wagered using code{" "}
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-rose-300">clip</span> counts toward your total.
            </p>
            {meta.updated && (
              <p className="mt-2 text-xs text-neutral-400">
                Range: {meta.range?.start_at} → {meta.range?.end_at} • Updated: {meta.updated}
              </p>
            )}
          </div>

          <section className="mt-10 flex flex-col items-center gap-4">
            <div className="text-sm uppercase tracking-widest text-neutral-400">Leaderboard ends in</div>
            <Countdown end={SEASON_END} />
          </section>

          {/* Loading / Error states */}
          {!entries && !error && (
            <div className="mt-14 text-center text-neutral-400">Loading leaderboard…</div>
          )}
          {error && (
            <div className="mt-14 text-center text-red-400">Failed to load leaderboard: {error}</div>
          )}

          {entries && entries.length > 0 && (
            <>
              <section className="mt-14">
                <div className="grid grid-cols-1 items-end justify-items-center gap-6 sm:grid-cols-3">
                  {top3[1] && <Podium place={2} entry={top3[1]} />}
                  {top3[0] && <Podium place={1} entry={top3[0]} />}
                  {top3[2] && <Podium place={3} entry={top3[2]} />}
                </div>
              </section>

              <section className="mt-14">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight text-white/90">Ranks 4 – 10</h2>
                  <div className="text-xs text-neutral-400">Updated every 5 minutes</div>
                </div>
                <div className="grid gap-3">
                  {rest.map((e) => (
                    <RankRow key={e.rank} entry={e} />
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="mt-16">
            <div className="relative overflow-hidden rounded-2xl border border-rose-400/20 bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-red-700/10 p-6">
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h3 className="text-xl font-semibold text-rose-300">Start playing on rainbet.com</h3>
                  <p className="mt-1 max-w-xl text-sm text-neutral-300">
                    Use code <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-rose-300">clip</span> on deposit to
                    auto-track your wagering for this leaderboard.
                  </p>
                </div>
                <a
                  href="https://rainbet.com/?r=clip"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-5 py-2.5 font-semibold text-rose-300 transition hover:border-rose-400/60 hover:bg-rose-500/20"
                >
                  Go to rainbet.com
                </a>
              </div>
              <Shine />
            </div>
          </section>
        </main>

        <footer className="border-t border-white/5 bg-neutral-950/60 py-8 text-center text-sm text-neutral-500">
          © {new Date().getFullYear()} aura<strong className="text-rose-300">rewards</strong>.com • Offical Leaderboard Page
        </footer>
      </div>
    </>
  );
}
