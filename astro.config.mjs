import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import wasm from "vite-plugin-wasm";
import sitemap from "@astrojs/sitemap";
import { CONFIG } from "./src/lib/config";

const localizedPages = [
  '',
  'take-a-screenshot',
  'screenshot-beautifier',
  'image-compressor',
  'convert',
  'viewer',
  'doc-viewer',
  'ppt-viewer',
  'excel-viewer',
  'csv-viewer',
  'pdf-viewer',
  'archive-viewer',
  'long-image',
  'video-convert',
  'background-remover',
  'blur-background-online',
  'photo-to-rounded',
  'privacy-policy',
  'terms-of-service'
];

const toAbsoluteUrl = (path) => new URL(path, CONFIG.website).toString();
const sitemapCustomPages = localizedPages.map((page) => toAbsoluteUrl(page ? `/${page}/` : '/'));

// https://astro.build/config
export default defineConfig({
  site: CONFIG.website,
  trailingSlash: 'ignore',
  compressHTML: false,
  integrations: [tailwind(), react(), sitemap({
    customPages: sitemapCustomPages
  })],
  output: "server",
  vite: {
    plugins: [wasm()]
  },
  adapter: (await import("@astrojs/vercel/serverless")).default({
    webAnalytics: {
      enabled: process.env.NODE_ENV === 'production'
    }
  })
});
