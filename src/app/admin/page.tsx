import { AdminDashboard } from "./admin-dashboard";
import { superAdminDemoAuth } from "@/lib/mock-data";
import { RoleGate } from "@/app/components/role-gate";

export default function AdminPage() {
  return (
    <RoleGate role="super_admin" title="SuperAdmin">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Супер-админ</h1>
        <p className="-mt-2 text-sm text-slate-600">
          Витрина призов, метрики, графики и разбор каждого отзыва по ответам брифа.
        </p>
        <div className="-mt-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <strong>Демо-доступ:</strong> {superAdminDemoAuth.login} / {superAdminDemoAuth.password}
        </div>
        <AdminDashboard />
      </main>
    </RoleGate>
  );
}
