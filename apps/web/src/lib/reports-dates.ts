import { torontoTodayDateString } from "./carer-availability-dates";

/** First and last calendar dates of the current Toronto month. */
export function currentTorontoMonthRange(): { dateFrom: string; dateTo: string } {
  const today = torontoTodayDateString();
  const [year, month] = today.split("-");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function defaultReportSearch(): { dateFrom: string; dateTo: string } {
  return currentTorontoMonthRange();
}
