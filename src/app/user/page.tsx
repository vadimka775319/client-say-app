import { CabinetShell } from "@/app/components/cabinet-shell";
import { UserCabinet } from "./user-cabinet";

export const dynamic = "force-dynamic";

export default function UserPage() {
  return (
    <CabinetShell title="Личный кабинет" subtitle="Баллы, профиль и призы">
      <main className="cabinet-page max-w-5xl px-5 py-8 md:px-8">
        <UserCabinet />
      </main>
    </CabinetShell>
  );
}
