import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ColorPicker, Button, message, Spin, Modal, Slider } from 'antd';
import { RawImage } from '@huggingface/transformers';
import { Icon } from './Icons'
import { DownBtn } from './DownBtn';
import { UploadDragger } from './UploadDragger';
import { cn, fileToDataURL, url2Blob, canvas2Blob, copyAsBlob, toDownloadFile, computedSize } from '../lib/utils';
import useKeyboardShortcuts from '../lib/useKeyboardShortcuts';
import usePaste from '../lib/usePaste';
import { getModnetInstance, onModnetStatusChange, MODNET_STATUS } from '../lib/modnetSingleton';

const REMOVE_BACKGROUND_STATUS = {
    LOADING: 0, // 模型加载中（WebGPU）
    FALLBACK_WASM: 1, // 降级为 WASM 加载中（较慢）
    LOAD_ERROR: 2, // 加载失败
    LOAD_SUCCESS: 3, // 加载成功
    PROCESSING: 4, // 处理中
    PROCESSING_SUCCESS: 5 // 处理成功
};

const loadImageFromUrl = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
});

export default function Remover({ variant = 'remove' }) {
    const isBlurMode = variant === 'blur';
    const [messageApi, contextHolder] = message.useMessage();
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [bgColor, setBgColor] = useState('rgba(255,255,255, 0)');
    const [photoUrl, setPhotoUrl] = useState('');
    const [transparentUrl, setTransparentUrl] = useState('');
    const [photoData, setPhotoData] = useState('');
    const [originalDataUrl, setOriginalDataUrl] = useState('');
    const [cutoutDataUrl, setCutoutDataUrl] = useState('');
    const [blurRadius, setBlurRadius] = useState(18);
    const [isGrid, setIsGrid] = useState(false);
    const [showOrigin, setShowOrigin] = useState(false);

    const [removeBgStatus, setRemoveBgStatus] = useState();
    const modelRef = useRef(null);
    const processorRef = useRef(null);

    useEffect(() => {
        // 订阅全局单例状态变化（抠图页和虚化页共享）
        const unsubscribe = onModnetStatusChange((status) => {
            switch (status) {
                case MODNET_STATUS.LOADING:
                    setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOADING);
                    break;
                case MODNET_STATUS.FALLBACK_WASM:
                    setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.FALLBACK_WASM);
                    break;
                case MODNET_STATUS.LOAD_ERROR:
                    setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOAD_ERROR);
                    messageApi.error({
                        content: '模型加载失败，请稍后重试！',
                        onClick: () => getModnetInstance()
                    });
                    break;
                case MODNET_STATUS.READY:
                    setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.LOAD_SUCCESS);
                    break;
            }
        });

        // 触发加载（若已加载则直接返回缓存实例）
        getModnetInstance()
            .then(({ model, processor, backend }) => {
                modelRef.current = model;
                processorRef.current = processor;
                if (backend === 'wasm') {
                    messageApi.info('当前环境不支持 WebGPU，已降级为 WASM 模式，首次推理可能较慢。');
                }
            })
            .catch(() => {
                // 错误已通过 onModnetStatusChange 处理
            });

        return unsubscribe;
    }, []);

    usePaste(async (file) => {
        if (removeBgStatus === REMOVE_BACKGROUND_STATUS.LOADING || removeBgStatus === REMOVE_BACKGROUND_STATUS.FALLBACK_WASM) return messageApi.info('抠图功能正在加载中！');
        if (loading) return messageApi.info('正在处理中，请稍候！');
        fileToDataURL(file).then(img => {
            setPhotoData(img);
            setOriginalDataUrl(img.src);
            setCutoutDataUrl('');
            setTransparentUrl('');
            const imgbase64 = toDraw(img);
            setPhotoUrl(imgbase64);
        }).catch(error => console.error(error));
    }, [loading]);

    useKeyboardShortcuts(() => toDownload(), () => toCopy(), [photoData, bgColor, blurRadius, loading]);

    const imageSize = useMemo(() => computedSize(photoData.width, photoData.height), [photoData]);

    useEffect(() => {
        const processImage = async () => {
            const model = modelRef.current;
            const processor = processorRef.current;
            if (!model || !processor || !photoUrl) return;
            setLoading(true);
            setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.PROCESSING);
            const img = await RawImage.fromURL(photoUrl);

            // 预处理图像
            const { pixel_values } = await processor(img);

            // 生成图像蒙版
            const { output } = await model({ input: pixel_values });
            const maskData = (
                await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(
                    img.width,
                    img.height
                )
            ).data;

            const cutoutCanvas = document.createElement('canvas');
            cutoutCanvas.width = img.width;
            cutoutCanvas.height = img.height;
            const cutoutCtx = cutoutCanvas.getContext('2d');

            cutoutCtx.drawImage(img.toCanvas(), 0, 0);
            const pixelData = cutoutCtx.getImageData(0, 0, img.width, img.height);
            for (let i = 0; i < maskData.length; ++i) {
                pixelData.data[4 * i + 3] = maskData[i];
            }
            cutoutCtx.putImageData(pixelData, 0, 0);
            const cutoutUrl = cutoutCanvas.toDataURL('image/png');
            setCutoutDataUrl(cutoutUrl);
            setTransparentUrl(cutoutUrl);

            if (isBlurMode) {
                const resultUrl = await composeBlurredBackground(photoUrl, cutoutUrl, blurRadius);
                setTransparentUrl(resultUrl);
                const imgFile = await url2Blob(resultUrl);
                const image = await fileToDataURL(imgFile);
                setPhotoData(image);
            } else {
                const imgFile = await canvas2Blob(cutoutCanvas);
                const image = await fileToDataURL(imgFile);
                setPhotoData(image);
            }
            setLoading(false);
            setRemoveBgStatus(REMOVE_BACKGROUND_STATUS.PROCESSING_SUCCESS);
        };
        processImage();
    }, [photoUrl]);

    useEffect(() => {
        const redrawBlurredImage = async () => {
            if (!isBlurMode || !originalDataUrl || !cutoutDataUrl || loading) return;
            setLoading(true);
            try {
                const resultUrl = await composeBlurredBackground(originalDataUrl, cutoutDataUrl, blurRadius);
                setTransparentUrl(resultUrl);
                const imgFile = await url2Blob(resultUrl);
                const image = await fileToDataURL(imgFile);
                setPhotoData(image);
            } catch (error) {
                messageApi.error('更新模糊背景失败。');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        redrawBlurredImage();
    }, [blurRadius]);

    const beforeUpload = async (file) => {
        const img = await fileToDataURL(file);
        setPhotoData(img);
        setOriginalDataUrl(img.src);
        setCutoutDataUrl('');
        setTransparentUrl('');
        const imgbase64 = toDraw(img);
        setPhotoUrl(imgbase64);
        return Promise.reject();
    }

    const composeBlurredBackground = async (originUrl, cutoutUrl, radius) => {
        const [origin, cutout] = await Promise.all([
            loadImageFromUrl(originUrl),
            loadImageFromUrl(cutoutUrl)
        ]);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = origin.width;
        canvas.height = origin.height;

        const bleed = Math.max(12, radius * 2);
        ctx.save();
        ctx.filter = `blur(${radius}px)`;
        ctx.drawImage(origin, -bleed, -bleed, origin.width + bleed * 2, origin.height + bleed * 2);
        ctx.restore();
        ctx.drawImage(cutout, 0, 0, origin.width, origin.height);
        return canvas.toDataURL('image/png');
    }

    const toDraw = (image, bgColor) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { width, height } = image;
        canvas.width = width;
        canvas.height = height;
        if (bgColor) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(image, 0, 0, width, height);
        // 导出图片
        const imgbase64 = canvas.toDataURL("image/png");
        return imgbase64;
    }

    const onBgChange = (e) => {
        const color = e.toRgbString();
        setBgColor(color);
    }

    const toDownload = () => {
        if (loading) return messageApi.info('正在处理中，请稍候！');
        const imgbase64 = toDraw(photoData, bgColor);
        toDownloadFile(imgbase64, 'shotEasy.png');
        messageApi.success('下载成功！');
    }
    const toCopy = () => {
        if (loading) return messageApi.info('正在处理中，请稍候！');
        setLoading(true);
        const imgbase64 = toDraw(photoData, bgColor);
        url2Blob(imgbase64).then(value => {
            copyAsBlob(value).then(() => {
                messageApi.success('复制成功！');
            }).catch(() => {
                messageApi.error('复制失败！');
            });
        }).catch(error => {
            messageApi.error('复制失败！');
        }).finally(() => {
            setLoading(false);
        });
    }

    const toRefresh = () => {
        if (loading) return messageApi.info('正在处理中，请稍候！');
        setPhotoUrl('');
        setPhotoData('');
        setTransparentUrl('');
        setOriginalDataUrl('');
        setCutoutDataUrl('');
    }

    return (
        <>
            {contextHolder}
            <Spin spinning={removeBgStatus === REMOVE_BACKGROUND_STATUS.LOADING || removeBgStatus === REMOVE_BACKGROUND_STATUS.FALLBACK_WASM} tip={removeBgStatus === REMOVE_BACKGROUND_STATUS.FALLBACK_WASM ? '当前环境不支持 WebGPU，降级为 WASM 加载中（较慢）...' : '正在加载模型并在本地运行...'}>
                <div className={cn("rounded-md shadow-lg border-t overflow-hidden border-t-gray-600 antialiased", isGrid ? 'tr':'polka')}>
                    <div className="flex gap-4 justify-center flex-col-reverse bg-white p-2 border-b shadow-md md:flex-row md:justify-between">
                        <div className="flex items-center justify-center gap-3">
                            {!isBlurMode && <ColorPicker allowClear size="small" value={bgColor} onChange={onBgChange} />}
                            {!isBlurMode && <Button type="text" shape="circle" className={isGrid && 'text-[#1677ff]'} icon={<Icon name="Grip" />} onClick={() => setIsGrid(!isGrid)}></Button>}
                            {isBlurMode && <div className="flex w-48 items-center gap-3 text-xs text-slate-600">
                                <Icon name="Sparkles" />
                                <Slider className="flex-1" min={4} max={36} value={blurRadius} onChange={setBlurRadius} tooltip={{ formatter: value => `${value}px` }} />
                            </div>}
                            <div className="active:[&_.ant-btn:not(:disabled)]:bg-[#1677ff]/20">
                                <Button type="text" shape="circle" className="[&_span]:active:text-[#1677ff]" icon={<Icon name="SplitSquareHorizontal" />} onMouseDown={() => setShowOrigin(true)} onMouseLeave={() => setShowOrigin(false)} onMouseUp={() => setShowOrigin(false)}></Button>
                            </div>
                        </div>
                        <div className="flex gap-3 items-center justify-center">
                            {photoData && <div className="text-xs opacity-60">{photoData.width} x {photoData.height} px</div>}
                            <DownBtn disabled={!transparentUrl} loading={loading} toDownload={toDownload} toCopy={toCopy} />
                            <Button type="text" disabled={!transparentUrl} loading={loading} icon={<Icon name="Eraser" />} onClick={toRefresh}></Button>
                        </div>
                    </div>
                    <div className="relative min-h-[200px] p-10">
                        <div className="flex w-full items-center justify-center relative z-10">
                            {!photoUrl && <UploadDragger beforeUpload={beforeUpload} />}
                            <Spin spinning={loading} delay={500}>
                                {photoUrl && <div className={cn("overflow-hidden w-auto", transparentUrl && 'opacity-0 absolute top-0 left-0 transition-all z-10', showOrigin && 'opacity-100')}><img src={photoUrl} alt="抠图前的原始图片" width={imageSize.width} height={imageSize.height} className="w-full object-cover" /></div>}
                                {transparentUrl && <div className="overflow-hidden w-auto relative z-[9]"><img src={transparentUrl} alt={isBlurMode ? "背景虚化后的图片" : "已去除背景的图片"} className="w-full" /></div>}
                                {transparentUrl && !isBlurMode && <div className="absolute z-0 w-full h-full top-0 left-0" style={{
                                    background: bgColor
                                }}></div>}
                            </Spin>
                        </div>
                    </div>
                </div>
            </Spin>
            <canvas ref={canvasRef} className="hidden"></canvas>
        </>
    )
} 
