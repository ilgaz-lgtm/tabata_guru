import { SettingsForm } from "@/components/SettingsForm";
import { SubPageHeader } from "@/components/SubPageHeader";

export const metadata = { title: "Settings · Tabata" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <SubPageHeader title="Workout" />
      <SettingsForm />
    </main>
  );
}
