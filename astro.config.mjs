import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import wasm from "vite-plugin-wasm";
import sitemap from "@astrojs/sitemap";
import { CONFIG } from "./src/lib/config";

// 双部署支持：通过 DEPLOY_TARGET 环境变量切换 adapter
// - Vercel:  DEPLOY_TARGET=vercel （默认）
// - Cloudflare: DEPLOY_TARGET=cloudflare
const DEPLOY_TARGET = process.env.DEPLOY_TARGET || 'vercel';

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

async function getAdapter() {
  if (DEPLOY_TARGET === 'cloudflare') {
    const cloudflare = (await import("@astrojs/cloudflare")).default;
    return cloudflare({ mode: 'directory' });
  }
  const vercel = (await import("@astrojs/vercel/serverless")).default;
  return vercel({
    webAnalytics: {
      enabled: process.env.NODE_ENV === 'production'
    }
  });
}

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
  adapter: await getAdapter()
});
