import { deployMetaJsonResponse } from "@/lib/deploy-meta-response";

/** Дубликат /api/deploy-meta — тот же JSON; путь под /api/site/* если nginx проксирует только этот префикс. */
export async function GET() {
  return deployMetaJsonResponse();
}
