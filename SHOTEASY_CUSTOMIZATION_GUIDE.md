# ShotEasy 定制修改手册（升级后恢复指南）

> 适用场景：升级 astro、react-filerobot-image-editor 等依赖，或重新 clone 项目后，按此文档逐步恢复所有定制修改。

---

## 总体目标

1. 开发环境屏蔽 GA/GTM 控制台红字
2. 改为**单语言（仅中文）**站点，URL 不带 `zh-CN` 前缀
3. 移除 `/blog` 路由
4. 移除首页扩展安装链接、Filerobot 署名、More Tools 区块、美化页"新版本"横幅
5. **全站英文汉化**（包括 react-filerobot-image-editor 内部硬编码的滤镜名）
6. **MODNet 模型本地化 + 全局单例**（抠图页与虚化页共享同一模型实例，离线可用）

---

## 一、路径 & 单语言改造

### 1. `src/lib/localePaths.js`
把多语言路径生成改为纯中文无前缀模式。

```js
const normalizePath = (path = '/') => {
    if (!path || path === '/') return '/';
    return `/${path.replace(/^\/+|\/+$/g, '')}`;
};

export const getRelativeLocaleUrl = (locale = 'zh-CN', path = '/') => {
    return normalizePath(path);
};
```
> 删除所有对 `en` 无前缀的特殊处理分支。

### 2. `src/i18n/index.js`
只加载 `zh-CN` 语言包，硬编码返回中文。

```js
import zhCn from '@i18n/zh-CN/index';

export const languages = { 'zh-CN': zhCn };
export const getLocale = () => 'zh-CN';
export const getLang = () => zhCn;
```

### 3. 删除非中文语言目录
`src/i18n/` 下**只保留** `zh-CN/` 目录，其余（en、ja 等）全部删除。同时删除 `src/pages/` 下多语言动态路由残留的非中文页面集群文件（如 `*En*.astro`、`*Ru*.astro` 等），以及 `src/pages/blog/` 整个目录（若存在）。

### 4. `src/layouts/Layout.astro`
- 删除多语言 alternates（SEO 的 languageAlternates 直接 `false` 或不传）
- 删除 `toLocalizedPath` 中带语言前缀的拼接逻辑
- **重要**：用 `import.meta.env.PROD` 包裹 GA/GTM 脚本，仅生产环境加载，彻底屏蔽开发环境报错：

```astro
{import.meta.env.PROD && (
  <>
    <!-- Google Tag Manager -->
    <script>...</script>
    <!-- End Google Tag Manager -->
  </>
)}
```

### 5. `astro.config.mjs` 屏蔽 Vercel Web Analytics 开发环境报错
Vercel adapter 的 `webAnalytics.enabled: true` 会在所有环境注入 `cdn.vercel-insights.com` 脚本，开发环境会报 `ERR_CONNECTION_CLOSED`。改为仅生产环境启用：

```js
adapter: vercel({
  webAnalytics: {
    enabled: process.env.NODE_ENV === 'production'
  }
})
```

---

## 二、删除 /blog 路径与 More Tools、扩展链接、Filerobot 署名

### 1. 删除 Blog 相关
- 移除 `src/pages/blog/` 整个目录
- 移除 Footer、Header、首页 IndexPage 中指向 `/blog` 的链接
- 移除多语言切换器 `showLanguageSwitcher` 相关渲染

### 2. 首页 `src/components/IndexPage.astro`
- 删除**扩展安装按钮**（安装 Chrome 扩展等按钮、其关联变量、href 指向 Chrome Web Store 的链接）
- 删除 **"Image Editor by Filerobot Image Editor"** 署名链接文字
- 删除 **More Tools** 区块（含背景图、按钮组），以及该区块对应的 `import` 静态资源

### 3. 美化页 "新版本即将推出" 横幅 `src/components/BeautifierPage.astro`
- 删除 `<div class="pt-2 pb-4 text-center text-xs [&_a]:inline-block">` 包含 `t.new` 的整块元素
- 语言包里 `src/i18n/zh-CN/beautifier.js` 的 `new` key 可保留，不必删

---

## 三、语言包汉化（zh-CN）

### 1. `src/i18n/zh-CN/nav.js`
Viewer 名称 & 标题翻译：
```js
viewer: {
    name: '查看器',
    title: 'Office 文档查看器',
},
```
把其余 en 残留的 key（如果还有 "Screenshot"、"Compress" 之类）也逐个改为中文。

### 2. 其他子模块
`edit.js / screenshot.js / beautifier.js / remover.js / converter.js / viewer.js / compress.js / round.js / stitched.js / blur.js / video.js` 等——对照 UI 检查是否有英文 key，逐条翻译即可；这些文件在本次会话中已完成。

---

## 四、SEO & Schema 结构化数据汉化

### 1. `src/lib/toolSeoContent.js`
`TOOL_FEATURES` 每个工具的特性列表从英文改为中文，例如：
```js
const TOOL_FEATURES = {
  screenshot: ['屏幕捕获', '裁剪保存', '浏览器授权流程'],
  beautifier: ['截图背景美化', '设备边框', '社交平台导出'],
  // ...其他工具
};
```

### 2. 所有工具页（ScreenshotPage / BeautifierPage / RemoverPage 等）
每个 `<ToolStructuredData browserRequirements="...">` 处传入的英文描述统一汉化，如：
- 原 "Requires Screen Capture API and HTML5 Canvas" → "需要浏览器支持 Screen Capture API 与 HTML5 Canvas"
- 默认值在 `src/components/ToolStructuredData.astro` 里改为：
  `browserRequirements = '需要支持 HTML5 的现代浏览器'`

---

## 五、React 组件硬编码英文汉化（核心重灾区）

### 共享组件
| 文件 | 汉化内容 |
|---|---|
| `src/components/DownBtn.jsx` | Download/Copy 按钮 label 及 tooltip |
| `src/components/UploadDragger.jsx` | 默认拖放提示、粘贴提示 |
| `src/components/LocalProcessingBlock.astro` | 标题 + 两段正文（如 "No Upload, Local Processing" → "本地处理，无需上传"） |
| `src/components/Footer.astro` | 核心工具标题介绍、`aiPrompt` 中文提示、5 个 AI 图标链接 `aria-label` / `title` / sr-only 文本 |
| `src/components/Toolbar.jsx` | `presets.label="Recommended"` → "推荐"、WebRTC 截图 Tooltip |
| `src/components/DrawerSide.jsx` | "返回"按钮、图片颜色/纯色/渐变/宇宙渐变/桌面 等 h4 标题、alt |

### 截图工具 `src/components/screenshot/`
| 文件 | 汉化内容 |
|---|---|
| `Screenshot.jsx` | "Screenshot" → **截图**；底部提示条 * |
| `UploadFile.jsx` | "Upload / Paste image" → **上传 / 粘贴图片** |
| `ToolBar.jsx` | Landscape/Portrait → 横向/竖向；ROTATION→旋转角度；ASPECT→比例；Undo/Apply Crop Tooltip；messageApi 成功/失败提示 * |
| `ImageBox.jsx` | alt="Screenshot preview" → **截图预览** |

### 美化工具 `src/components/Beautifier.jsx`
- 拖放框提示、下载/复制/截图失败 messageApi 提示
- 右侧面板 label：Margin/Padding/Roundness/Shadow/Background/Canvas/Frame → **外边距/内边距/圆角/阴影/背景/画布/边框**
- Frame 下拉 options：None / Light Glass / Dark Glass / Macbook Pro M3 / iPhone 15 Pro / macOS Light / macOS Dark / Windows Light / Windows Dark → 对应中译
- Contain/Cover/Fill → **包含/覆盖/填充**
- Watermark 开关、水印内容 placeholder、Color/Direction/Only Background → **水印/水印内容/颜色/方向/仅背景**
- 两张 img 的 alt 文本

### 抠图工具
| 文件 | 汉化内容 |
|---|---|
| `src/components/Remover.jsx` | "WebGPU is not supported" Modal 整个 title+content；Failed to load model；"Remove background function loading!" → **抠图功能正在加载中！**；Spin tip "Loading the model..." → **正在加载模型并在本地运行...**；Working hard, please wait → **正在处理中，请稍候！**；Failed to update blur background；Download Success/Copied Success/Copy Failed 全家桶翻译；两张 img alt |
| `src/components/RemoverPage.astro` | Use Hugging Face Transformers.js 说明段落中文 * |

### 长图拼接/转换/压缩/圆角（messageApi + UI 标签全汉化）
- `LongImageComposer.jsx`：**除了 messageApi 提示外，还需汉化大量 UI label**：
  - 按钮：Add Images / PDF → 添加图片 / PDF；Add Folder → 添加文件夹；Compose → 合成；Download → 下载；Reset → 重置
  - Tooltip：Move up → 上移；Move down → 下移；Remove → 移除；Download composed image → 下载合成图片；Compose first → 请先合成；Clear all → 清空所有；Compose → 合成
  - 顶部信息条：Images → 图片；Estimated → 预估尺寸
  - 底部设置栏：Direction → 方向；Vertical/Horizontal → 竖向/横向；Output Width/Output Height → 输出宽度/输出高度；Relative/Pixel → 相对比例/固定像素；Margin → 边距；Gap → 间隔；Format → 格式
  - 结果区：Preview → 预览；PDF Preview → PDF 预览
  - 列表 img alt：long image item preview → 长图合成素材预览；Composed long image preview → 合成后的长图预览
  - messageApi 提示：Please select image / Image load failed / Please add images first / output too large / Compose Success / Compose failed / Download Success 等
- `ConvertTool.jsx`：Unsupported files skipped / File load failed / Folder selection failed / PDF serialization failed / Conversion failed / Convert Success / Convert files before downloading 等
- `Compressor.jsx`：Download Success
- `Rounded.jsx`：Download/Copy 成功失败提示

> 💡 推荐做法：全文本搜索 `"Download Success!"`、`'Copied Success!'`、`'Copy Failed!'`、`'Working hard'`、`title="` 中英文字样、`label: '` 开头的英文，批量 grep 替换。

---

## 六、react-filerobot-image-editor 汉化（编辑页 EditBox.jsx）

这是最容易遗漏的模块——因为它的 label 有两套：**走 translator 的常规 UI 文字** 以及 **硬编码的滤镜名**。

文件：`src/components/EditBox.jsx`

### Step 1. 加 `translations` prop
覆盖所有能覆盖的 translator key（参考 defaultTranslations.js 完整 key）：

```js
<FilerobotImageEditor
  ...
  useBackendTranslations={false}
  translations={{
    name: '名称', save: '保存', saveAs: '另存为', back: '返回',
    loading: '加载中...', cancel: '取消', apply: '应用', warning: '警告',
    confirm: '确认', discardChanges: '放弃更改',
    undoTitle: '撤销上一步', redoTitle: '重做上一步',
    showImageTitle: '显示原图', zoomInTitle: '放大', zoomOutTitle: '缩小',
    resetOperations: '重置/删除所有操作',
    adjustTab: '调整', finetuneTab: '微调', filtersTab: '滤镜',
    watermarkTab: '水印', annotateTabLabel: '标注',
    resize: '调整大小', resizeTab: '调整大小',
    imageName: '图片名称', cropTool: '裁剪',
    original: '原始', custom: '自定义', square: '正方形',
    landscape: '横向', portrait: '竖向', ellipse: '椭圆',
    classicTv: '经典电视', cinemascope: '宽银幕',
    arrowTool: '箭头', blurTool: '模糊', brightnessTool: '亮度',
    contrastTool: '对比度', ellipseTool: '椭圆',
    flipX: '水平翻转', unFlipX: '取消水平翻转',
    flipY: '垂直翻转', unFlipY: '取消垂直翻转',
    hue: '色相', brightness: '亮度', saturation: '饱和度', value: '明度',
    imageTool: '图片', importing: '导入中...',
    addImage: '+ 添加图片', uploadImage: '上传图片',
    fromGallery: '从图库选择', lineTool: '直线',
    penTool: '画笔', polygonTool: '多边形', sides: '边数',
    rectangleTool: '矩形', cornerRadius: '圆角',
    resizeWidthTitle: '宽度（像素）', resizeHeightTitle: '高度（像素）',
    toggleRatioLockTitle: '锁定比例', resetSize: '恢复原始尺寸',
    rotateTool: '旋转', textTool: '文字',
    textSpacings: '文字间距', textAlignment: '文字对齐',
    fontFamily: '字体', size: '大小',
    letterSpacing: '字间距', lineHeight: '行高',
    warmthTool: '暖度', addWatermark: '+ 添加水印',
    addTextWatermark: '+ 添加文字水印',
    addWatermarkTitle: '选择水印类型',
    uploadWatermark: '上传水印', addWatermarkAsText: '以文字添加',
    padding: '内边距', paddings: '内边距', shadow: '阴影',
    horizontal: '水平', vertical: '垂直', blur: '模糊',
    opacity: '不透明度', transparency: '透明度',
    position: '位置', stroke: '描边',
    saveAsModalTitle: '另存为', extension: '扩展名',
    format: '格式', quality: '质量',
    actualSize: '实际大小 (100%)', fitSize: '适应窗口',
    download: '下载', width: '宽度', height: '高度', tabsMenu: '菜单',
  }}
/>
```

### Step 2. 汉化硬编码滤镜名（关键！）
Filerobot 的滤镜名 `Filters.constants.js` 是硬编码的，不经过 translator。
用 **MutationObserver + DOM 替换** 的方式在运行时翻译，完全不侵入 node_modules：

```js
import React, { useState, useRef, useEffect } from 'react';

// ...

const editorContainerRef = useRef(null);

const FILTER_LABELS_CN = {
  'Original': '原图',
  'Invert': '反色',
  'Black & White': '黑白',
  'Sepia': '复古棕褐',
  'Solarize': '曝光反转',
  'Clarendon': '克莱伦登',
  'Gingham': '格纹',
  'Moon': '月光',
  'Lark': '云雀',
  'Reyes': '雷耶斯',
  'Juno': '朱诺',
  'Slumber': '沉睡',
  'Crema': '奶油',
  'Ludwig': '路德维希',
  'Aden': '亚丁',
  'Perpetua': '永恒',
  'Amaro': '阿马罗',
  'Mayfair': '梅费尔',
  'Rise': '晨曦',
  'Hudson': '哈德逊',
  'Valencia': '瓦伦西亚',
  'X-Pro II': 'X-Pro II 胶片',
  'Sierra': '塞拉利昂',
  'Willow': '杨柳',
  'Lo-Fi': '低保真',
  'Inkwell': '墨井（灰度）',
  'Hefe': '赫菲',
  'Nashville': '纳什维尔',
  'Stinson': '斯廷森',
  'Vesper': '薄暮',
  'Earlybird': '晨鸟',
  'Brannan': '布兰南',
  'Sutro': '苏特罗',
  'Toaster': '烤面包机',
  'Walden': '瓦尔登',
  '1977': '1977 复古',
  'Kelvin': '开尔文',
  'Maven': '专家',
  'Ginza': '银座',
  'Skyline': '天际线',
  'Dogpatch': '多帕奇',
  'Brooklyn': '布鲁克林',
  'Helena': '海伦娜',
  'Ashby': '阿什比',
  'Charmes': '魅力',
};

useEffect(() => {
  let observer;
  const container = editorContainerRef.current;
  if (!container) return;
  const translateLabels = () => {
    container.querySelectorAll('.FIE_filters-item-label').forEach(lbl => {
      const key = lbl.textContent?.trim();
      if (FILTER_LABELS_CN[key]) lbl.textContent = FILTER_LABELS_CN[key];
    });
  };
  translateLabels();
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.addedNodes?.length || m.type === 'characterData') {
        translateLabels();
        break;
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  return () => observer?.disconnect();
}, [isReader]);

// 给容器绑定 ref
return (
  <div className="h-[600px] min-h-[500px] rounded-md shadow-lg" ref={editorContainerRef}>
    {isReader && <FilerobotImageEditor ... />}
  </div>
);
```

> ⚠️ 升级 `react-filerobot-image-editor` 后，如果 `FIE_filters-item-label` className 或滤镜名列表变化，请重新对照 `node_modules/react-filerobot-image-editor/lib/components/tools/Filters/Filters.constants.js` 的 `AVAILABLE_FILTERS`，把新增/改名的滤镜补进 `FILTER_LABELS_CN`。

---

## 七、Footer AI 询问链接汉化
`src/components/Footer.astro` 修改以下几处：
1. `aiPrompt` 英文句 → 中文版本（参考当前文件里的中文 prompt）
2. 每个 `<a>` 的 `aria-label` / `title`：
   - `Ask ChatGPT about ShotEasy` → **向 ChatGPT 询问 ShotEasy**（Google AI / Claude / Perplexity / Grok 同理）
3. `<span class="sr-only">` 里的 `Ask AI about ShotEasy` → **向 AI 询问 ShotEasy 相关信息**

---

## 八、回归验证清单（升级后必测）

用浏览器逐个打开以下页面，肉眼扫一遍：

| 页面路径 | 检查点 |
|---|---|
| `/` 首页 | Header 导航全中文；按钮无英文；编辑器顶部 8 个按钮中文；点击「滤镜」45 个滤镜名全中文；底部 More Tools 不出现；"Install Extension" 按钮不出现 |
| `/take-a-screenshot/` 截图 | 主按钮"截图"中文；工具栏按钮、裁剪 Tooltip、消息提示无英文 |
| `/screenshot-beautifier/` 美化 | 添加图片框文字中文；右侧 Margin/Padding/… 全部标签中文；下载/复制提示中文；"返回"/背景分类标题中文 |
| `/background-remover/` 抠图 | loading tip、WebGPU 提示、复制/下载消息中文 |
| `/rounded-corners/` 圆角 | 下载/复制消息中文 |
| `/image-compressor/` 压缩 | 同上 |
| `/convert/` 转换 | 同上 |
| `/viewer/` 查看器 | Header 上 "Viewer" → "查看器" |
| `/long-image/` 拼长图 | messageApi 提示中文 |
| 所有页面 Footer | AI 链接 tooltip 中文（鼠标悬停 5 个图标）；核心工具标题/介绍中文；无 "blog" 链接 |
| 控制台 | 无 GA/GTM 红字 |

---

## 九、快速搜索正则（升级后一键扫漏）

```powershell
# 重点排查 .astro/.jsx 中裸露英文 UI 提示
grep -rn "Download Success" src/
grep -rn "Copy Failed" src/
grep -rn "Working hard" src/
grep -rn "messageApi\.(success|error|info|warning).*\('[A-Z]" src/components
# UI 组件 label
grep -rn "label=\"[A-Z]" src/components
grep -rn ">[A-Z][a-zA-Z &-]* [A-Z][a-zA-Z]*<" src/components
# Filerobot
grep -rn "Original\|Invert\|Black & White" src/components/EditBox.jsx
```

发现有未翻译的英文，对照本手册第五、六部分补上即可。

---

## 十、MODNet 模型本地化 + 全局单例

### 背景
抠图页 (`/background-remover/`) 和虚化页 (`/blur-background-online/`) 都使用 `Xenova/modnet` 模型。
改造前：每打开一个页面都会从 `huggingface.co` 下载一次模型（~25MB），国内网络经常超时。
改造后：模型文件放在 `public/models/` 下走同源加载，且两个页面共享同一个模型实例。

### Step 1. 下载模型文件到 public 目录

```powershell
$base = 'https://huggingface.co/Xenova/modnet/resolve/main'
$dst = 'public/models/Xenova/modnet'
New-Item -ItemType Directory -Force -Path "$dst/onnx" | Out-Null
Invoke-WebRequest "$base/config.json" -OutFile "$dst/config.json"
Invoke-WebRequest "$base/preprocessor_config.json" -OutFile "$dst/preprocessor_config.json"
Invoke-WebRequest "$base/onnx/model.onnx" -OutFile "$dst/onnx/model.onnx"
```

需要的文件清单：

| 文件 | 大小 | 用途 |
|---|---|---|
| `public/models/Xenova/modnet/config.json` | 83B | 模型结构配置 |
| `public/models/Xenova/modnet/preprocessor_config.json` | 365B | processor 预处理配置 |
| `public/models/Xenova/modnet/onnx/model.onnx` | 25.9MB | fp32 模型权重 |

### Step 2. 创建全局单例 `src/lib/modnetSingleton.js`

> **关键改进：WebGPU 失败自动 fallback 到 WASM**。因为 `navigator.gpu` 存在 ≠ 能拿到 GPU adapter（Trae 预览浏览器、公司远程桌面、显卡驱动、Chrome flag 等都可能导致 adapter 请求失败），所以先 `probeWebGpuAdapter()` 主动探活，再降级，保证任意浏览器都能用。

```js
import { env, AutoModel, AutoProcessor } from '@huggingface/transformers';

env.localModelPath = '/models/';
env.allowRemoteModels = false;
env.allowLocalModels = true;

export const MODNET_MODEL_ID = 'Xenova/modnet';

export const MODNET_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    FALLBACK_WASM: 'fallback_wasm', // WebGPU 不可用，降级 WASM 加载中
    READY: 'ready',
    LOAD_ERROR: 'load_error',
});

export const MODNET_BACKEND = Object.freeze({
    WEBGPU: 'webgpu', WASM: 'wasm',
});

let instancePromise = null;
let currentStatus = MODNET_STATUS.IDLE;
let currentBackend = null;
const statusListeners = new Set();

function emitStatus(next) {
    currentStatus = next;
    statusListeners.forEach((fn) => { try { fn(next, currentBackend); } catch (_) {} });
}

export function onModnetStatusChange(fn) {
    statusListeners.add(fn);
    fn(currentStatus, currentBackend);
    return () => statusListeners.delete(fn);
}

async function probeWebGpuAdapter() {
    try {
        if (!navigator?.gpu?.requestAdapter) return false;
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        return !!adapter;
    } catch { return false; }
}

export async function getModnetInstance() {
    if (instancePromise) return instancePromise;
    instancePromise = (async () => {
        emitStatus(MODNET_STATUS.LOADING);
        if (env?.backends?.onnx?.wasm) env.backends.onnx.wasm.proxy = false;

        const devices = [];
        if (await probeWebGpuAdapter()) devices.push(MODNET_BACKEND.WEBGPU);
        devices.push(MODNET_BACKEND.WASM); // 必有兜底

        let lastError = null;
        for (const device of devices) {
            if (device === MODNET_BACKEND.WASM) emitStatus(MODNET_STATUS.FALLBACK_WASM);
            try {
                const [model, processor] = await Promise.all([
                    AutoModel.from_pretrained(MODNET_MODEL_ID, { device, quantized: false }),
                    AutoProcessor.from_pretrained(MODNET_MODEL_ID),
                ]);
                currentBackend = device;
                emitStatus(MODNET_STATUS.READY);
                return { model, processor, backend: device };
            } catch (error) { lastError = error; }
        }
        currentBackend = null;
        emitStatus(MODNET_STATUS.LOAD_ERROR);
        instancePromise = null;
        throw lastError ?? new Error('模型加载失败：所有后端不可用');
    })();
    return instancePromise;
}
```

### Step 3. 修改 `src/components/Remover.jsx` 接入单例

**REMOVE_BACKGROUND_STATUS 调整**：去掉 NO_SUPPORT_WEBGPU，新增 FALLBACK_WASM：
```jsx
const REMOVE_BACKGROUND_STATUS = {
    LOADING: 0, FALLBACK_WASM: 1, LOAD_ERROR: 2,
    LOAD_SUCCESS: 3, PROCESSING: 4, PROCESSING_SUCCESS: 5,
};
```

**Import 改动**：去掉直接 import `env/AutoModel/AutoProcessor`，改为：
```jsx
import { RawImage } from '@huggingface/transformers';
import { getModnetInstance, onModnetStatusChange, MODNET_STATUS } from '../lib/modnetSingleton';
```

**模型加载 useEffect 改动**：监听 FALLBACK_WASM，READY 时提示降级信息；Spin tip 做两种文案区分：
```jsx
useEffect(() => {
    const unsubscribe = onModnetStatusChange((status) => {
        switch (status) {
            case MODNET_STATUS.LOADING:
                setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOADING); break;
            case MODNET_STATUS.FALLBACK_WASM:
                setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.FALLBACK_WASM); break;
            case MODNET_STATUS.LOAD_ERROR:
                setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOAD_ERROR);
                messageApi.error({ content: '模型加载失败，请稍后重试！', onClick: () => getModnetInstance() }); break;
            case MODNET_STATUS.READY:
                setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOAD_SUCCESS); break;
        }
    });
    getModnetInstance()
        .then(({ model, processor, backend }) => {
            modelRef.current = model;
            processorRef.current = processor;
            if (backend === 'wasm') messageApi.info('当前环境不支持 WebGPU，已降级为 WASM 模式，首次推理可能较慢。');
        })
        .catch(() => {});
    return unsubscribe;
}, []);
```

**Spin tip 文案区分**：
```jsx
<Spin
  spinning={removeBgStatus === LOADING || removeBgStatus === FALLBACK_WASM}
  tip={removeBgStatus === FALLBACK_WASM
    ? '当前环境不支持 WebGPU，降级为 WASM 加载中（较慢）...'
    : '正在加载模型并在本地运行...'}
>
```

> 推理逻辑（`processImage` useEffect）不需要改，仍然用 `modelRef.current` / `processorRef.current`。

### 验证要点
- 打开抠图页 → 网络面板应显示 `GET /models/Xenova/modnet/config.json`（localhost 同源），无 `huggingface.co` 请求
- 控制台**不应**出现 `no available backend found` / `Failed to get GPU adapter` 错误（已被自动 fallback 处理）
- 导航到虚化页 → 网络面板**不应**出现新的 model.onnx 请求（单例已缓存）
- 控制台两个 warning（"Unknown model class modnet"）是正常的，Transformers.js 没有注册 MODNet 类型，自动用 base class 兜底
- 降级 WASM 时：页面顶部会出现中文 info 提示，Spin tip 会切换文案

---

## 十一、双部署支持（Vercel + Cloudflare）

### 架构设计
同一份代码库，通过环境变量 `DEPLOY_TARGET` 切换 adapter，支持部署到两个平台：

| 平台 | 环境变量 | 模型文件 | COEP 头文件 | Analytics |
|---|---|---|---|---|
| Vercel（默认）| `DEPLOY_TARGET=vercel` 或不设 | `model.onnx` (fp32, 25.9MB) | `vercel.json` | Vercel Web Analytics |
| Cloudflare | `DEPLOY_TARGET=cloudflare` | `model_quantized.onnx` (INT8, 6.6MB) | `public/_headers` | Cloudflare Web Analytics（Dashboard 配置） |

### 1. `astro.config.mjs` 动态 adapter
```js
const DEPLOY_TARGET = process.env.DEPLOY_TARGET || 'vercel';

async function getAdapter() {
  if (DEPLOY_TARGET === 'cloudflare') {
    const cloudflare = (await import("@astrojs/cloudflare")).default;
    return cloudflare({ mode: 'directory' });
  }
  const vercel = (await import("@astrojs/vercel/serverless")).default;
  return vercel({
    webAnalytics: { enabled: process.env.NODE_ENV === 'production' }
  });
}

export default defineConfig({
  // ...其他配置
  adapter: await getAdapter()
});
```

### 2. `src/lib/modnetSingleton.js` 模型量化切换
```js
const DEPLOY_TARGET = import.meta.env.VITE_DEPLOY_TARGET || 'vercel';
const USE_QUANTIZED = DEPLOY_TARGET === 'cloudflare';
// ...
const quantized = USE_QUANTIZED;
```
> Vercel 用 fp32（精度高），Cloudflare 用 INT8 量化（6.6MB，满足 25MB 单文件限制）

### 3. COEP 头文件（两个平台各一份）
- `vercel.json`：Vercel 用
- `public/_headers`：Cloudflare Pages 用
- 两者内容相同：`COOP: same-origin` + `COEP: credentialless`
- `credentialless` 比 `require-corp` 兼容性更好（允许加载无 CORS 头的跨域资源）

### 4. 模型文件
`public/models/Xenova/modnet/onnx/` 下放两份：
- `model.onnx` (25.9MB) — Vercel 用
- `model_quantized.onnx` (6.6MB) — Cloudflare 用
- 下载脚本：`scripts/download-models.ps1`（支持 hf-mirror.com 镜像 fallback）

### 5. 部署配置

#### Vercel 部署
```bash
# 无需额外设置，默认就是 vercel
pnpm build
# 或在 Vercel Dashboard 不设 DEPLOY_TARGET
```

#### Cloudflare Pages 部署
```bash
# 构建命令（在 Cloudflare Pages Dashboard 设置）：
DEPLOY_TARGET=cloudflare pnpm build

# 环境变量（Dashboard → Settings → Environment Variables）：
# VITE_DEPLOY_TARGET = cloudflare
# NODE_VERSION = 20
```

### 6. `.env.example` 环境变量模板
项目根目录有 `.env.example`，开发者复制为 `.env` 修改即可。

### 验证要点
- Vercel：Network 请求 `model.onnx`（25.9MB）
- Cloudflare：Network 请求 `model_quantized.onnx`（6.6MB）
- 两个平台 Response Headers 都应包含 `Cross-Origin-Embedder-Policy: credentialless`
