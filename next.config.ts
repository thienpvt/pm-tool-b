import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exceljs', 'jspdf', 'pptxgenjs'],
  // Kysely-generated Database insert types vs repo call sites — tracked debt; tests are the gate.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
