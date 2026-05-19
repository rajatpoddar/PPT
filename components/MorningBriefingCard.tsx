import { Volume2, CalendarDays, ClipboardList } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

export interface MorningBriefingCardProps {
  plan: {
    goals: string[];
    voiceNoteUrl?: string | null;
    date: string;
    site: { name: string };
  } | null;
}

/**
 * MorningBriefingCard — displays the Admin's daily plan for the Supervisor's morning briefing.
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export default function MorningBriefingCard({ plan }: MorningBriefingCardProps) {
  if (!plan) {
    return (
      <section aria-label="Morning briefing" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <CalendarDays className="h-7 w-7 text-gray-400" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-gray-800">No plan for today</h2>
            <p className="text-sm text-gray-500">The Admin has not created a plan for your site today. Check back later or contact your Admin.</p>
          </div>
        </div>
      </section>
    );
  }

  const formattedDate = new Date(plan.date).toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <section aria-label="Morning briefing" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-900">Morning Briefing</h2>
        </div>
        <p className="text-sm text-gray-500">{plan.site.name} &mdash; {formattedDate}</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700">Today&apos;s Goals</h3>
          {plan.goals.length > 0 ? (
            <ul aria-label="Plan goals" className="flex flex-col gap-2">
              {plan.goals.map((goal, index) => (
                <li key={index} className="flex items-start gap-3 rounded-lg bg-blue-50 px-4 py-3">
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-800">{goal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">No goals specified.</p>
          )}
        </div>

        {plan.voiceNoteUrl && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Volume2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Voice Instruction (Admin)</span>
            </div>
            <AudioPlayer src={plan.voiceNoteUrl} label="Admin voice instruction" />
          </div>
        )}
      </div>
    </section>
  );
}
