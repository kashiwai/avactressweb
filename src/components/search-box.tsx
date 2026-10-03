"use client";
// 全画面共通の検索窓。入力と同時に候補を出し、キーボードだけでも選べる
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, Store, User, X } from "lucide-react";

type Result = {
  actresses: Array<{ id: number; name: string; kana: string }>;
  shops: Array<{ id: number; name: string; pref: string; area: string; genre: string }>;
  areas: Array<{ href: string; label: string }>;
};
type Item = { href: string; label: string; sub: string; kind: "actress" | "shop" | "area" };

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  // 語ごとの候補（一度取った語は通信せずに出す）
  const [cache, setCache] = useState<Record<string, Item[]>>({});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  const term = q.trim();
  // 入力中の語の候補（取得済みならすぐ出す）
  const items: Item[] = (term && cache[term]) || [];
  const cached = term in cache;

  useEffect(() => {
    if (!term || cached) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const r = (await res.json()) as Result;
        const list: Item[] = [
          ...r.areas.map((a) => ({ href: a.href, label: a.label, sub: "地域", kind: "area" as const })),
          ...r.actresses.map((a) => ({ href: `/actresses/${a.id}`, label: a.name, sub: a.kana || "女優", kind: "actress" as const })),
          ...r.shops.map((s) => ({ href: `/shops/${s.id}`, label: s.name, sub: `${s.pref} ${s.area}・${s.genre}`, kind: "shop" as const })),
        ];
        setCache((c) => ({ ...c, [term]: list }));
        setActive(-1);
      } catch {
        /* 入力中の取り消しは無視 */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, cached]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const Icon = { actress: User, shop: Store, area: MapPin };

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) go(items[active].href);
          else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="text"
          enterKeyHint="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="女優・店舗・地域で検索"
          aria-label="女優名・店舗名・地域で検索"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full rounded-full border border-line bg-surface py-2.5 pl-9 pr-9 text-[15px] shadow-sm placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-rose-100"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground" aria-label="入力を消す">
            <X className="size-4" />
          </button>
        )}
      </form>
      {open && q.trim() && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">候補がありません。Enterで全体から検索します</li>
          ) : (
            items.map((it, i) => {
              const I = Icon[it.kind];
              return (
                <li key={it.href} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-accent-soft" : ""}`}
                  >
                    <I className="size-4 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{it.label}</span>
                      <span className="block truncate text-xs text-muted">{it.sub}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
