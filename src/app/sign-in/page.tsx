import { Suspense } from "react";
import { getDeployInfo } from "@/lib/deploy-info";
import SignInForm from "./sign-in-form";

export const dynamic = "force-dynamic";

function SignInFallback() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10">
      <p className="text-sm text-slate-600">Загрузка…</p>
    </main>
  );
}

export default function SignInPage() {
  const di = getDeployInfo();
  const serverBuildLabel =
    di.gitShort != null
      ? `${di.gitShort}${di.buildEpoch != null ? ` · ${di.buildEpoch}` : ""}`
      : null;

  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm serverBuildLabel={serverBuildLabel} />
    </Suspense>
  );
}
