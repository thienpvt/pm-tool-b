import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exceljs', 'jspdf', 'pptxgenjs'],
};

export default nextConfig;
