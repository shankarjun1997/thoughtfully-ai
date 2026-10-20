import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: {
    "/api/import-link": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/*.wasm",
      "./node_modules/tesseract.js-core/*.wasm.js",
      "./node_modules/tesseract.js-core/*.js",
      "./tessdata/*",
    ],
  },
};
export default nextConfig;
