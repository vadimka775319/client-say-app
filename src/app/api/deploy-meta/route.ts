import { deployMetaJsonResponse } from "@/lib/deploy-meta-response";

/** JSON версии деплоя — всегда через Node (обходит отсутствие public/deploy-meta.json и nginx static). */
export async function GET() {
  return deployMetaJsonResponse();
}
