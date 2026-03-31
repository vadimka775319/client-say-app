import { UserCabinet } from "./user-cabinet";
import { RoleGate } from "@/app/components/role-gate";

export default function UserPage() {
  return (
    <RoleGate role="user" title="Личный кабинет пользователя">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
        <UserCabinet />
      </main>
    </RoleGate>
  );
}
