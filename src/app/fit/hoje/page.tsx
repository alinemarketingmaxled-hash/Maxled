import { redirect } from "next/navigation";
import { loadFitContext } from "@/lib/fit/server";
import { weekdayIndex } from "@/lib/fit/program";

/** Shortcut from the "+" menu: today's session, or the next one on a rest day. */
export default async function HojePage() {
  const { week } = await loadFitContext();
  const today = weekdayIndex();
  const day = week.days.find((d) => d.weekday === today) ?? week.days.find((d) => d.weekday > today) ?? week.days[0];
  redirect(`/fit/treino/${day.index}${day.weekday === today ? "/play" : ""}`);
}
