import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exceljs', 'pptxgenjs'],
};

export default nextConfig;
