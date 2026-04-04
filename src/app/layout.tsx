import type { Metadata } from "next";
import { BRAND_TITLE } from "@/lib/brand";
import "@fontsource-variable/onest/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description:
    "Собирайте структурированные отзывы через QR, мотивируйте клиентов баллами и призами, смотрите аналитику по каждому ответу.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
