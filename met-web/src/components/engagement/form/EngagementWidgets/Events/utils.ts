/**
 * Forms event date strings by combining a date with time range values.
 *
 * @param date - The event date in "YYYY-MM-DD" format
 * @param time_from - The start time in "HH:mm" format
 * @param time_to - The end time in "HH:mm" format
 * @returns A timezone naive datetime string in ISO format
 * @returns dateFrom - The start date-time in ISO format "YYYY-MM-DDTHH:mm:00"
 * @returns dateTo - The end date-time in ISO format "YYYY-MM-DDTHH:mm:00"
 */
export function formEventDates(date: string, time_from: string, time_to: string) {
    // date: "YYYY-MM-DD"
    // time_from: "HH:mm"
    // time_to: "HH:mm"
    const dateFrom = `${date}T${time_from}:00`;
    const dateTo = `${date}T${time_to}:00`;

    return { dateFrom, dateTo };
}
