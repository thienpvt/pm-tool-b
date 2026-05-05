import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gambaru",
  description: "Project Management Document Automation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} bg-slate-50 min-h-screen`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
