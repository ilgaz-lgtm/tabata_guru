import { SensorsPanel } from "@/components/SensorsPanel";
import { SubPageHeader } from "@/components/SubPageHeader";

export const metadata = { title: "Sensors · Tabata" };

export default function SensorsPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <SubPageHeader title="Sensors" />
      <SensorsPanel />
    </main>
  );
}
