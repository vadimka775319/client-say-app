import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;

export function requireAuthSecret(): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (env.NODE_ENV !== "production") return "development-only-secret-32chars!!";
  throw new Error("AUTH_SECRET must be set and at least 32 characters.");
}
