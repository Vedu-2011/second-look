// DailyMed helpers with no network, shared by the client, the tests and /samples.

export function dailyMedUrl(setId: string) {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** DailyMed's "Nov 06, 2026" → "2026-11-06". null when it isn't a date. */
export function parseDailyMedDate(s: string | null | undefined): string | null {
  const m = s?.trim().match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  const month = m && MONTHS[m[1].toLowerCase()];
  return m && month ? `${m[3]}-${month}-${m[2].padStart(2, "0")}` : null;
}
