# ShotEasy 部署指南（Vercel）

本项目基于 Astro + React，部署到 **Vercel** 平台。

---

## 一、前置准备

### 1. 下载模型文件

抠图功能使用 MODNet 模型（fp32，25.9MB），需下载到 `public/models/` 目录：

```powershell
# 国内网络建议使用镜像站
$base = 'https://hf-mirror.com/Xenova/modnet/resolve/main'
$dst = 'public/models/Xenova/modnet'
New-Item -ItemType Directory -Force -Path "$dst/onnx" | Out-Null
Invoke-WebRequest "$base/config.json" -OutFile "$dst/config.json"
Invoke-WebRequest "$base/preprocessor_config.json" -OutFile "$dst/preprocessor_config.json"
Invoke-WebRequest "$base/onnx/model.onnx" -OutFile "$dst/onnx/model.onnx"
```

如果 hf-mirror.com 不可用，可回退到官方源：

```powershell
$base = 'https://huggingface.co/Xenova/modnet/resolve/main'
```

### 2. 需要的文件

| 文件 | 大小 | 用途 |
|---|---|---|
| `public/models/Xenova/modnet/config.json` | 83B | 模型结构配置 |
| `public/models/Xenova/modnet/preprocessor_config.json` | 365B | processor 预处理配置 |
| `public/models/Xenova/modnet/onnx/model.onnx` | 25.9MB | FP32 模型（Vercel 部署用） |

---

## 二、Vercel 部署

### 方式 A：GitHub Actions 自动化部署（推荐）

1. 在 GitHub 仓库 **Settings → Secrets → Actions** 添加：
   - `VERCEL_TOKEN`（从 [Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens) 获取）
   - `VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID`（从 Vercel 项目 Settings → General 获取）

2. 创建 `.github/workflows/vercel-deploy.yml`：

```yaml
name: Vercel Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Download models
        run: |
          $base = 'https://hf-mirror.com/Xenova/modnet/resolve/main'
          $dst = 'public/models/Xenova/modnet'
          mkdir -p "$dst/onnx"
          Invoke-WebRequest "$base/config.json" -OutFile "$dst/config.json"
          Invoke-WebRequest "$base/preprocessor_config.json" -OutFile "$dst/preprocessor_config.json"
          Invoke-WebRequest "$base/onnx/model.onnx" -OutFile "$dst/onnx/model.onnx"

      - name: Build
        run: pnpm build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: .
```

3. 推送到 `main` 分支自动触发部署。

### 方式 B：Vercel CLI 手动部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

---

## 三、环境变量说明

本项目**无需设置特殊环境变量**。`modnetSingleton.js` 默认使用 fp32 模型（`USE_QUANTIZED = false`），适合 Vercel 部署。

如需本地测试 Cloudflare 部署模式（不推荐），可设置：
```bash
DEPLOY_TARGET=cloudflare VITE_DEPLOY_TARGET=cloudflare pnpm build
```

---

## 四、COOP/COEP 头配置

WebAssembly 多线程需要以下响应头，已通过 `vercel.json` 配置：

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

---

## 五、常见问题

### Q1: 部署后抠图功能报「模型加载失败」

**原因**：模型文件未下载到 `public/models/` 目录。

**解决**：确保 `public/models/Xenova/modnet/onnx/model.onnx` 存在且大小约 25.9MB。

### Q2: 本地开发时控制台报「WebGPU is not supported」

这是正常提示，模型会自动降级到 WASM 后端运行。

### Q3: 构建超时

模型文件 25.9MB，首次下载需要较长时间。确保网络通畅，或使用国内镜像站。

---

## 六、快速部署命令

```bash
# 本地测试构建
pnpm build

# 本地预览
pnpm preview

# 部署到 Vercel
vercel --prod
```
