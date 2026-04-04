import { CabinetShell } from "@/app/components/cabinet-shell";
import { BriefByIdClient } from "./brief-client";

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CabinetShell title="Прохождение брифа" subtitle="Вопросы от партнёра">
      <BriefByIdClient id={id} />
    </CabinetShell>
  );
}
