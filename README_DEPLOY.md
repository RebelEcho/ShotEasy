# ShotEasy 部署指南

本项目支持双平台部署：**Vercel**（默认）与 **Cloudflare Pages**。两套部署共用同一份代码，通过环境变量 `DEPLOY_TARGET` 切换 Astro 适配器与模型版本。

---

## 一、模型下载脚本

抠图页（`/background-remover/`）与虚化页（`/blur-background-online/`）使用 `Xenova/modnet` 模型。模型文件放在 `public/models/` 下走同源加载，不依赖 huggingface.co 远程拉取。

### 脚本：`scripts/download-models.ps1`

下载以下文件到 `public/models/Xenova/modnet/`：

| 文件 | 大小 | 用途 |
|---|---|---|
| `config.json` | 83B | 模型结构配置 |
| `preprocessor_config.json` | 365B | 预处理配置 |
| `onnx/model.onnx` | 25.9MB | fp32 模型（Vercel 用） |
| `onnx/model_quantized.onnx` | 6.6MB | INT8 量化模型（Cloudflare 用） |

### 本地运行

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts/download-models.ps1
```

脚本特性：
- 已存在且非空的文件会跳过，支持增量下载
- 主站 `huggingface.co` 失败时自动 fallback 到镜像站 `hf-mirror.com`
- 每个文件最多重试 3 次，连接超时 30 秒

> ⚠️ 脚本内部使用 `curl.exe`（Windows 自带），仅在 Windows 环境可直接运行。Linux/macOS 需改用 `Invoke-WebRequest` 或单独的 bash 版本。GitHub Actions 工作流已使用 `windows-latest` 运行器规避此问题。

### 模型选择逻辑

`src/lib/modnetSingleton.js` 根据 `import.meta.env.VITE_DEPLOY_TARGET` 决定加载哪个模型：

```
VITE_DEPLOY_TARGET=cloudflare  → model_quantized.onnx (6.6MB, INT8)
VITE_DEPLOY_TARGET=vercel / 空 → model.onnx (25.9MB, fp32, 精度更高)
```

原因：Cloudflare Pages 单文件大小限制 **25MB**，fp32 模型 25.9MB 会超限；Vercel 无此限制，使用高精度 fp32 模型。

---

## 二、Vercel 部署

Vercel 是默认部署目标，**无需手动设置任何环境变量**。

### 步骤

1. 将仓库导入 Vercel
2. Framework Preset 选择 **Astro**
3. Build Command：`pnpm build`（Vercel 会自动识别）
4. Output Directory：`dist`
5. Install Command：`pnpm install --frozen-lockfile`
6. 直接部署即可

### 为什么 Vercel 不需要设置 `DEPLOY_TARGET`？

`astro.config.mjs` 中：

```js
const DEPLOY_TARGET = process.env.DEPLOY_TARGET || 'vercel';
```

- **默认值是 `vercel`**：不设环境变量时，自动走 Vercel 适配器分支。
- **Vercel 自动注入 `VERCEL=1`**：虽然本项目没用它，但 Vercel 的构建环境开箱即用，`DEPLOY_TARGET` 为空 → fallback 到 `vercel` → 加载 `@astrojs/vercel/serverless` 适配器。
- **`VITE_DEPLOY_TARGET` 也为空**：`modnetSingleton.js` 中 `const USE_QUANTIZED = DEPLOY_TARGET === 'cloudflare'` 为 `false`，自动选用 fp32 高精度模型。
- **模型无大小限制**：Vercel 对静态资源无 25MB 限制，fp32 模型可直接托管。

### COOP/COEP 头

WebAssembly 多线程（SharedArrayBuffer）要求跨域隔离。`vercel.json` 已配置：

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
```

Vercel 会自动读取此文件，无需额外操作。

---

## 三、Cloudflare Pages 部署

Cloudflare 部署**必须手动设置环境变量**，推荐使用 GitHub Actions 自动化（见下文）。

### 为什么 Cloudflare 需要手动设置 `DEPLOY_TARGET`？

四个关键差异：

1. **没有平台默认值兜底**
   `astro.config.mjs` 的 `DEPLOY_TARGET` 默认是 `vercel`。如果不显式设为 `cloudflare`，会加载 `@astrojs/vercel/serverless` 适配器，构建产物是 Vercel 格式（`.vercel/`），Cloudflare 无法部署。必须设 `DEPLOY_TARGET=cloudflare` 才会加载 `@astrojs/cloudflare` 适配器。

2. **Cloudflare 不像 Vercel 那样自动注入平台标识**
   Vercel 构建时自动注入 `VERCEL=1` 等环境变量；Cloudflare Pages 本地构建或远程构建时不会自动告诉 Astro「我是 Cloudflare」，必须由开发者显式声明。

3. **单文件 25MB 限制强制使用量化模型**
   必须设 `VITE_DEPLOY_TARGET=cloudflare`，`modnetSingleton.js` 才会加载 6.6MB 的 `model_quantized.onnx`。否则加载 25.9MB 的 fp32 模型，部署时会被 Cloudflare 拒绝（单文件超限）。

4. **客户端环境变量需 `VITE_` 前缀**
   - `DEPLOY_TARGET`（无前缀）：仅 Node 构建时可见，给 `astro.config.mjs` 用
   - `VITE_DEPLOY_TARGET`（带前缀）：Vite 注入到客户端代码，给 `modnetSingleton.js` 在浏览器运行时读取
   两者必须同时设置，缺一不可。

### 方式 A：GitHub Actions 自动部署（推荐）

已配置 `.github/workflows/cloudflare-deploy.yml`，推送到 `main` 分支自动触发。流程：

```
checkout → setup pnpm → install → 下载模型 → 校验模型 → 构建 → 部署到 Cloudflare Pages
```

**前置准备**（在 GitHub 仓库 Settings → Secrets and variables → Actions 添加）：

| Secret | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需 `Cloudflare Pages:Edit` 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID（仪表盘右下角可见） |

**Cloudflare 项目**：需先在 Cloudflare Pages 控制台创建名为 `shot-easy-website` 的项目（首次部署也可手动跑一次 workflow 创建）。

工作流已内置：
- `windows-latest` 运行器（匹配 `curl.exe` 的下载脚本）
- 自动注入 `DEPLOY_TARGET=cloudflare` 和 `VITE_DEPLOY_TARGET=cloudflare`
- 构建前校验量化模型存在且非空，失败即终止

### 方式 B：Cloudflare Pages 控制台直连 Git

若不使用 GitHub Actions，直接在 Cloudflare Pages 连接 Git 仓库：

1. **构建前必须下载模型**：在 Cloudflare 构建命令前加下载步骤。由于 Cloudflare 构建环境是 Linux，`download-models.ps1`（依赖 `curl.exe`）无法直接运行，需改用 bash：

   ```bash
   # Build command
   mkdir -p public/models/Xenova/modnet/onnx && \
   cd public/models/Xenova/modnet && \
   curl -L -o config.json https://huggingface.co/Xenova/modnet/resolve/main/config.json && \
   curl -L -o preprocessor_config.json https://huggingface.co/Xenova/modnet/resolve/main/preprocessor_config.json && \
   curl -L -o onnx/model_quantized.onnx https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx && \
   cd ../../../../.. && pnpm install --frozen-lockfile && pnpm build
   ```

   > 注意：Cloudflare 国内访问 huggingface.co 可能超时，建议用镜像 `hf-mirror.com` 替换域名。

2. **设置环境变量**（Cloudflare Pages → Settings → Environment variables）：

   | 变量 | 值 |
   |---|---|
   | `DEPLOY_TARGET` | `cloudflare` |
   | `VITE_DEPLOY_TARGET` | `cloudflare` |
   | `NODE_VERSION` | `20` |

3. **COOP/COEP 头**：`public/_headers` 已配置，Cloudflare Pages 会自动读取：

   ```
   /*
     Cross-Origin-Opener-Policy: same-origin
     Cross-Origin-Embedder-Policy: credentialless
   ```

4. Build output directory：`dist`

---

## 四、本地开发切换部署目标

如需本地预览不同平台的构建产物：

```powershell
# 模拟 Vercel（默认）
$env:DEPLOY_TARGET="vercel"; $env:VITE_DEPLOY_TARGET="vercel"; pnpm build

# 模拟 Cloudflare
$env:DEPLOY_TARGET="cloudflare"; $env:VITE_DEPLOY_TARGET="cloudflare"; pnpm build
```

本地开发（`pnpm dev`）通常不需要设这些变量，默认走 Vercel 分支即可。

---

## 五、常见问题

### Q1: Cloudflare 部署后抠图功能报「模型加载失败」

**原因**：`VITE_DEPLOY_TARGET` 未设为 `cloudflare`，加载了 25.9MB 的 fp32 模型，超出 Cloudflare 25MB 限制被截断。

**解决**：确认环境变量 `VITE_DEPLOY_TARGET=cloudflare` 已设置，且 `public/models/Xenova/modnet/onnx/model_quantized.onnx` 存在（6.6MB）。GitHub Actions 工作流已内置校验步骤。

### Q2: 构建报错「Cannot find module @astrojs/cloudflare」

**原因**：`DEPLOY_TARGET=cloudflare` 触发动态导入 `@astrojs/cloudflare`，但依赖未安装。

**解决**：`package.json` 已含 `@astrojs/cloudflare` 依赖，执行 `pnpm install` 即可。

### Q3: WebAssembly 多线程不生效，抠图变慢

**原因**：COOP/COEP 头未生效，浏览器未开启 `SharedArrayBuffer`。

**解决**：
- Vercel：确认 `vercel.json` 存在且未被覆盖
- Cloudflare：确认 `public/_headers` 存在
- 浏览器控制台执行 `crossOriginIsolated`，应返回 `true`

### Q4: WebGPU 不可用时是否可用

可以。`modnetSingleton.js` 实现 WebGPU 失败自动 fallback 到 WASM 后端，保证所有浏览器可用。状态可通过 `getModnetStatus()` / `onModnetStatusChange()` 监听。

### Q5: GitHub Actions 下载模型超时

脚本已配置镜像 fallback（`hf-mirror.com`）和重试。如仍失败，可在 workflow 的 Download models 步骤前加代理或改用 Cloudflare R2 自托管模型。

### Q6: 模型文件是否应提交到 Git

**不建议**。模型文件较大（fp32 25.9MB + 量化 6.6MB），应通过下载脚本在构建前获取。`.gitignore` 应排除 `public/models/`。GitHub Actions 工作流会在每次部署时自动下载。
