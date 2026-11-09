// FDA DailyMed web services v2 (https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm).
// Verified Nov 9, 2026: spls.json?setid=… returns the current label's title + published_date; labels that were
// taken down return no data there, but spls/<setid>/history.json still lists their versions and dates.
// (The old v1 imprint endpoint is dead.)
import { cached } from "./cache";
import { fetchJson } from "./http";
import { dailyMedUrl, parseDailyMedDate } from "./dailymed-parse";
import type { LabelMeta } from "./types";

export { dailyMedUrl, parseDailyMedDate };

export const DAILYMED = "https://dailymed.nlm.nih.gov/dailymed/services/v2";

export async function labelMeta(setId: string): Promise<LabelMeta> {
  const url = `${DAILYMED}/spls.json?setid=${encodeURIComponent(setId)}`;
  return cached(url, async () => {
    const json = (await fetchJson(url)) as { data?: { title?: string; published_date?: string }[] };
    const current = json?.data?.[0];
    if (current) {
      return {
        setId,
        title: current.title ?? null,
        publishedDate: parseDailyMedDate(current.published_date),
        url: dailyMedUrl(setId),
        current: true,
      };
    }
    const histUrl = `${DAILYMED}/spls/${encodeURIComponent(setId)}/history.json`;
    const hist = (await fetchJson(histUrl).catch(() => null)) as {
      data?: { spl?: { title?: string | null }; history?: { published_date?: string }[] };
    } | null;
    return {
      setId,
      title: hist?.data?.spl?.title ?? null,
      publishedDate: parseDailyMedDate(hist?.data?.history?.[0]?.published_date),
      url: dailyMedUrl(setId),
      current: false,
    };
  });
}
