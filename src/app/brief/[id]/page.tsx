import { notFound } from "next/navigation";
import { CabinetShell } from "@/app/components/cabinet-shell";
import { computeBriefPoints } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { BriefByIdClient, type PublicBriefPayload } from "./brief-client";

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.brief.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      partner: { select: { companyName: true } },
    },
  });
  if (!row) notFound();

  const pointsForComplete = row.pointsOverride ?? computeBriefPoints(row.questions.length);

  const brief: PublicBriefPayload = {
    id: row.id,
    title: row.title,
    pointsForComplete,
    companyName: row.partner.companyName,
    questions: row.questions.map((q) => ({
      id: q.id,
      type: q.type === "TEXT" ? "text" : q.type === "RATING" ? "rating" : "choice",
      prompt: q.prompt,
      options:
        q.type === "CHOICE"
          ? Array.isArray(q.options)
            ? (q.options as unknown[]).map((x) => String(x))
            : []
          : [],
    })),
  };

  return (
    <CabinetShell title="Прохождение брифа" subtitle={brief.companyName}>
      <BriefByIdClient brief={brief} />
    </CabinetShell>
  );
}
