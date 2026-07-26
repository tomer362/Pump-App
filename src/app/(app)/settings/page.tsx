import { NavBar } from "@/components/ui/nav-bar";
import { SettingsForm } from "./settings-form";
import { requireUser } from "@/lib/session";
import { uploadsEnabled } from "@/lib/blob";

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
        email={me.email}
        username={me.username}
        image={me.image}
        uploadsEnabled={uploadsEnabled()}
      />
    </div>
  );
}
