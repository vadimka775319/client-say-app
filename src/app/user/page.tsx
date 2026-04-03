import { CabinetShell } from "@/app/components/cabinet-shell";
import { UserCabinet } from "./user-cabinet";

export default function UserPage() {
  return (
    <CabinetShell title="Личный кабинет" subtitle="Баллы, профиль и призы">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
        <UserCabinet />
      </main>
    </CabinetShell>
  );
}
