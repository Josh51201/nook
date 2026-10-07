import { upcomingBirthdays, type BirthdayPerson } from "./birthdays";
import { hasRealName } from "./profile";
import { supabase } from "./supabase";

// Plans a Birthday Gathering for each family member whose birthday is coming
// up (GIFT-035). Safe to call as often as you like: the database refuses
// duplicates, so it only ever creates what's missing. Failures are quiet — a
// missed birthday plan is retried next time Nook opens.

let lastRun = 0;

// Returns how many Gatherings were created. `force` skips the 10-minute
// breather between runs.
export async function planBirthdays(force = false): Promise<number> {
  if (!force && Date.now() - lastRun < 10 * 60 * 1000) return 0;
  lastRun = Date.now();

  try {
    const { data: members, error } = await supabase
      .from("burrow_members")
      .select("burrow_id, profile_id, profiles(display_name, birthday)");
    if (error || !members) return 0;

    const people: BirthdayPerson[] = [];
    for (const member of members) {
      const profile = member.profiles as unknown as { display_name: string | null; birthday: string | null } | null;
      if (profile?.birthday && hasRealName(profile.display_name)) {
        people.push({
          burrowId: member.burrow_id,
          profileId: member.profile_id,
          name: profile.display_name!.trim(),
          birthday: profile.birthday,
        });
      }
    }

    const plans = upcomingBirthdays(people);
    if (!plans.length) return 0;

    // Skip ones the database already knows about.
    const { data: planned } = await supabase
      .from("birthday_gatherings")
      .select("burrow_id, profile_id, year")
      .in("year", [...new Set(plans.map((p) => p.year))]);
    const done = new Set((planned ?? []).map((row) => `${row.burrow_id}:${row.profile_id}:${row.year}`));

    let created = 0;
    for (const plan of plans) {
      if (done.has(`${plan.burrowId}:${plan.profileId}:${plan.year}`)) continue;
      const { data, error: rpcError } = await supabase.rpc("plan_birthday", {
        target_burrow: plan.burrowId,
        target_profile: plan.profileId,
        birthday_year: plan.year,
        gathering_title: plan.title,
        gathering_ends_at: plan.endsAt.toISOString(),
      });
      if (!rpcError && data) created += 1;
    }
    return created;
  } catch {
    return 0;
  }
}
