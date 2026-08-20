import { addDaysToDateString, torontoTodayDateString } from "./carer-availability-dates";

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

/** Activity Log default: last 30 Toronto calendar days inclusive. */
export function defaultActivityLogSearch(): { dateFrom: string; dateTo: string } {
  const dateTo = torontoTodayDateString();
  return {
    dateFrom: addDaysToDateString(dateTo, -29),
    dateTo,
  };
}
