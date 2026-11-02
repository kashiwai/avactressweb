// robots.txt の確認（User-agent: * と自サイト名のグループの Disallow/Allow を見る簡易実装）
export const USER_AGENT = "AVShukkinNaviBot/1.0 (+schedule aggregator; contact via site)";

export function isAllowedByRobots(robotsTxt: string, path: string, agentToken = "avshukkinnavibot"): boolean {
  type Group = { agents: string[]; rules: Array<{ allow: boolean; path: string }> };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "disallow" || key === "allow") && cur) {
      lastWasAgent = false;
      if (key === "disallow" && val === "") continue;
      cur.rules.push({ allow: key === "allow", path: val });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agentToken.includes(a)));
  const target = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of target) {
    for (const r of g.rules) {
      const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      const re = new RegExp("^" + (pattern.endsWith("\\$") ? pattern.slice(0, -2) + "$" : pattern));
      if (re.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) {
        best = { allow: r.allow, len: r.path.length };
      }
    }
  }
  return best ? best.allow : true;
}

/** robots.txt を取得して判定。取得できない（404等）場合は許可として扱う */
const cache = new Map<string, { at: number; text: string | null; reason?: string }>();
const TTL_MS = 6 * 60 * 60_000;

export async function checkRobots(url: string): Promise<{ allowed: boolean; reason?: string }> {
  const u = new URL(url);
  const path = u.pathname + u.search;
  // 同じサイトを何千ページも読むため、robots.txt の中身は6時間使い回す（判定はURLごとに行う）
  const hit = cache.get(u.origin);
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (hit.text === null) return { allowed: false, reason: hit.reason ?? "robots.txt を確認できませんでした" };
    return isAllowedByRobots(hit.text, path) ? { allowed: true } : { allowed: false, reason: "robots.txt で取得が禁止されています" };
  }
  try {
    const res = await fetch(`${u.origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // 404 など（robots.txt が無い）サイトはすべて許可
    if (res.status >= 400 && res.status < 500) {
      cache.set(u.origin, { at: Date.now(), text: "" });
      return { allowed: true };
    }
    if (!res.ok) {
      const reason = `robots.txt の取得に失敗しました（${res.status}）`;
      cache.set(u.origin, { at: Date.now(), text: null, reason });
      return { allowed: false, reason };
    }
    const text = await res.text();
    cache.set(u.origin, { at: Date.now(), text });
    return isAllowedByRobots(text, path) ? { allowed: true } : { allowed: false, reason: "robots.txt で取得が禁止されています" };
  } catch {
    return { allowed: false, reason: "robots.txt を確認できませんでした（接続エラー）" };
  }
}
