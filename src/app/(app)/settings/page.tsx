import { NavBar } from "@/components/ui/nav-bar";
import { Card, FieldLabel } from "@/components/ui/primitives";
import { HistoryExportButtons } from "@/components/history/export-history";
import { SettingsForm } from "./settings-form";
import { requireUser } from "@/lib/session";
import { uploadsEnabled } from "@/lib/blob";
import { toWeekStart } from "@/lib/week";

export default async function SettingsPage() {
  const me = await requireUser();
  return (
    <div className="pb-8">
      <NavBar title="Settings" back="/profile" />
      <SettingsForm
        name={me.name}
        bio={me.bio}
        unit={me.unit}
        defaultRestSeconds={me.defaultRestSeconds}
        weekStart={toWeekStart(me.weekStart)}
        email={me.email}
        username={me.username}
        image={me.image}
        uploadsEnabled={uploadsEnabled()}
      />
      {/* Below the account rows: a file is something you reach for rarely, and
          every set you have logged is yours to take elsewhere. */}
      <div className="mt-6 px-4">
        <FieldLabel>Your data</FieldLabel>
        <Card className="space-y-3 p-4">
          <p className="text-[15px]">Export workout history</p>
          <HistoryExportButtons />
        </Card>
      </div>
    </div>
  );
}
