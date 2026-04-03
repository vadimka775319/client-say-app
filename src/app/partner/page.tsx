import { CabinetShell } from "@/app/components/cabinet-shell";
import { PartnerWorkspace } from "./partner-workspace";

export default function PartnerPage() {
  return (
    <CabinetShell title="Кабинет партнёра" subtitle="Брифы, QR и профиль компании">
      <PartnerWorkspace />
    </CabinetShell>
  );
}
