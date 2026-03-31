import { RoleGate } from "@/app/components/role-gate";
import { PartnerWorkspace } from "./partner-workspace";

export default function PartnerPage() {
  return (
    <RoleGate role="partner" title="Кабинет партнера">
      <PartnerWorkspace />
    </RoleGate>
  );
}
