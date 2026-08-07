import { env, AutoModel, AutoProcessor } from '@huggingface/transformers';

// 离线模型：文件存放在 public/models/ 下，通过 env.localModelPath 让 Transformers.js
// 从同源静态路径加载，而非 huggingface.co 远程拉取。
// 对应文件:
//   public/models/Xenova/modnet/config.json
//   public/models/Xenova/modnet/preprocessor_config.json
//   public/models/Xenova/modnet/onnx/model.onnx          (fp32, 25.9MB - Vercel 用)
//   public/models/Xenova/modnet/onnx/model_quantized.onnx (INT8, 6.6MB - Cloudflare 用)
env.localModelPath = '/models/';
env.allowRemoteModels = false;
env.allowLocalModels = true;

// 双部署支持：
// - Vercel: 不限制文件大小，用 fp32 模型（精度高）
// - Cloudflare: 单文件 25MB 限制，用 INT8 量化模型（6.6MB，精度略低但够用）
// 通过 import.meta.env.VITE_DEPLOY_TARGET 读取（由 .env 注入，默认 vercel）
const DEPLOY_TARGET = import.meta.env.VITE_DEPLOY_TARGET || 'vercel';
const USE_QUANTIZED = DEPLOY_TARGET === 'cloudflare';

export const MODNET_MODEL_ID = 'Xenova/modnet';

export const MODNET_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    FALLBACK_WASM: 'fallback_wasm', // WebGPU 不可用，正降级为 WASM
    READY: 'ready',
    LOAD_ERROR: 'load_error',
});

export const MODNET_BACKEND = Object.freeze({
    WEBGPU: 'webgpu',
    WASM: 'wasm',
});

let instancePromise = null;
let currentStatus = MODNET_STATUS.IDLE;
let currentBackend = null;
const statusListeners = new Set();

function emitStatus(next) {
    currentStatus = next;
    statusListeners.forEach((fn) => {
        try { fn(next, currentBackend); } catch (_) { /* ignore */ }
    });
}

export function getModnetStatus() {
    return currentStatus;
}

export function getModnetBackend() {
    return currentBackend;
}

export function onModnetStatusChange(fn) {
    statusListeners.add(fn);
    fn(currentStatus, currentBackend);
    return () => statusListeners.delete(fn);
}

/**
 * 判断用户环境是否有可用的 WebGPU 适配器。
 * 因为 navigator.gpu 存在 ≠ 能拿到 adapter（可能需要 --enable-unsafe-webgpu 或驱动限制），
 * 所以这里主动请求一次 adapter，作为后续 fallback 决策依据。
 */
async function probeWebGpuAdapter() {
    try {
        if (!navigator?.gpu?.requestAdapter) return false;
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        return !!adapter;
    } catch {
        return false;
    }
}

/**
 * 获取 MODNet 全局单例（model + processor）。
 * 多次调用共享同一份 Promise，确保抠图页和虚化页共用。
 * 策略：先尝试 WebGPU，失败则自动 fallback 到 WASM，保证任意浏览器可用。
 * @returns {Promise<{model: PreTrainedModel, processor: Processor, backend: 'webgpu'|'wasm'}>}
 */
export async function getModnetInstance() {
    if (instancePromise) return instancePromise;

    instancePromise = (async () => {
        emitStatus(MODNET_STATUS.LOADING);

        if (env?.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.proxy = false;
        }

        const quantized = USE_QUANTIZED;
        const devices = [];

        const hasWebGpu = await probeWebGpuAdapter();
        if (hasWebGpu) devices.push(MODNET_BACKEND.WEBGPU);
        devices.push(MODNET_BACKEND.WASM); // WASM 兜底

        let lastError = null;
        for (const device of devices) {
            if (device === MODNET_BACKEND.WASM) {
                emitStatus(MODNET_STATUS.FALLBACK_WASM);
            }
            try {
                const [model, processor] = await Promise.all([
                    AutoModel.from_pretrained(MODNET_MODEL_ID, { device, quantized }),
                    AutoProcessor.from_pretrained(MODNET_MODEL_ID),
                ]);
                currentBackend = device;
                emitStatus(MODNET_STATUS.READY);
                return { model, processor, backend: device };
            } catch (error) {
                lastError = error;
                // 继续尝试下一个后端
            }
        }

        // 所有后端都失败
        currentBackend = null;
        emitStatus(MODNET_STATUS.LOAD_ERROR);
        instancePromise = null;
        throw lastError ?? new Error('模型加载失败：所有后端不可用');
    })();

    return instancePromise;
}

/** 测试用：强制重置单例（仅开发调试） */
export function __resetModnetInstance() {
    instancePromise = null;
    currentBackend = null;
    emitStatus(MODNET_STATUS.IDLE);
}
