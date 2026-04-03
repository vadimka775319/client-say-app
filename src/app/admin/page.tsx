import { AdminDashboard } from "./admin-dashboard";
import { CabinetShell } from "@/app/components/cabinet-shell";
import { superAdminDemoAuth } from "@/lib/mock-data";

export default function AdminPage() {
  const showDemoHint = process.env.NODE_ENV === "development";

  return (
    <CabinetShell
      title="Супер-админ"
      subtitle="Витрина призов, метрики и разбор отзывов"
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8 md:px-8">
        {showDemoHint ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <strong>Демо-доступ (только dev):</strong> {superAdminDemoAuth.login} / {superAdminDemoAuth.password}
          </div>
        ) : null}
        <AdminDashboard />
      </main>
    </CabinetShell>
  );
}
