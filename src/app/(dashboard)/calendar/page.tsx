import { getCalendarPersonNames } from "@/actions/calendar";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage() {
  const personNames = await getCalendarPersonNames();
  return <CalendarView initialPersonNames={personNames} />;
}
