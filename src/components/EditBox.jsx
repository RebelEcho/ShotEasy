import React, { useState, useRef, useEffect } from 'react';
import FilerobotImageEditor, {
    TABS,
    TOOLS,
} from 'react-filerobot-image-editor';
import photo from '../static/photo.png';
import usePaste from '../lib/usePaste';
import { url2Blob, toDownloadFile } from '../lib/utils'

async function onSaveToClipboard(imageInfo) {
    const blob = await url2Blob(imageInfo.imageBase64);
    navigator.clipboard.write([
        new ClipboardItem({
            [imageInfo.mimeType]: blob,
        }),
        ]).catch((error) => {
            console.error(error);
        });
}

export default function App() {
    const fileInput = useRef(null);
    const [isReader, setIsReader] = useState(true);
    const [photoUrl, setPhotoUrl] = useState(photo.src);
    const [photoName, setPhotoName] = useState('neom-s6g6ZSxM3kQ-unsplash');

    usePaste((file) => {
        setPhotoUrl(window.URL.createObjectURL(file));
    })

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
        let container = editorContainerRef.current;
        if (!container) return;
        function translateLabels() {
            const labels = container.querySelectorAll('.FIE_filters-item-label');
            labels.forEach(lbl => {
                const key = lbl.textContent.trim();
                if (FILTER_LABELS_CN[key]) lbl.textContent = FILTER_LABELS_CN[key];
            });
        }
        translateLabels();
        observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes?.length || m.type === 'characterData') {
                    translateLabels();
                    break;
                }
            }
        });
        observer.observe(container, { childList: true, subtree: true, characterData: true });
        return () => observer?.disconnect();
    }, [isReader]);

    const handleSelect = () => {
        fileInput.current?.click();
    }
    const onSelectChange = (files) => {
        if (files.target?.files?.length) {
            setIsReader(false);
            const file = files.target.files[0];
            setPhotoName(file.name);
            setPhotoUrl(window.URL.createObjectURL(file));
            setTimeout(() => {
                setIsReader(true);
            }, 50);
        }
    }
    return (
        <>
            <div className="flex justify-center items-center gap-2 mb-6">
                <div className="relative">
                    <button className="py-1 flex gap-1 items-center px-4 rounded-full text-sm border-0 bg-[#6879eb] text-white" onClick={handleSelect}>选择图片进行编辑</button>
                    <input
                        ref={fileInput}
                        type="file"
                        id="file"
                        hidden
                        accept="image/jpeg,image/webp,image/png,image/gif,image/bmp,image/heic,image/heif"
                        onChange={onSelectChange}
                    />
                    <span className="absolute text-xs opacity-60 top-8 left-[50%] translate-x-[-50%]">或直接粘贴图片</span>
                    <svg className="absolute -right-12 top-1 opacity-80" xmlns="http://www.w3.org/2000/svg" version="1.1" width="54" height="54" x="0" y="0" viewBox="0 0 100 100"><g><path d="m74.3 66.8-5.8 5.8c-.6-20.7-8.9-27.8-13.6-30.1-.1-.4-.1-.8-.2-1.2-1-4.1-5.9-17.3-29.5-17.3h-.1v2h.1C47 26 51.7 37.9 52.6 41.7c-4.1-1.2-8-.2-9.7 2.4-1.5 2.3-1 5.2 1.4 8.1 3 3.6 5.7 2.8 6.7 2.3 2.6-1.3 4.2-5.2 4-9.5 5.7 3.4 10.9 12 11.4 27.6l-5.7-5.7-1.4 1.4 8.2 8.2 8.2-8.2zM50.1 52.7c-1.6.8-3.2-.5-4.3-1.8-1.8-2.1-2.2-4.2-1.2-5.7.9-1.3 2.6-2 4.6-2 .9 0 1.9.1 2.9.4l.9.3c.4 4.3-1 7.8-2.9 8.8z" fill="#000000" opacity="1"></path></g></svg>
                </div>
            </div>
            <div className="h-[600px] min-h-[500px] rounded-md shadow-lg" ref={editorContainerRef}>
                {isReader && <FilerobotImageEditor
                    source={photoUrl}
                    defaultSavedImageName={photoName}
                    onSave={(editedImageObject, designState) => {
                        const url = editedImageObject.imageBase64;
                        const { fullName: fileName } = editedImageObject;
                        toDownloadFile(url, fileName);
                    }}
                    theme={{}}
                    annotationsCommon={{
                        fill: '#ff0000',
                    }}
                    Text={{ text: 'Shot Easy' }}
                    Rotate={{ angle: 90, componentType: 'slider' }}
                    Crop={{
                        presetsItems: [
                            {
                                titleKey: 'classicTv',
                                descriptionKey: '4:3',
                                ratio: 4 / 3,
                                // icon: CropClassicTv, // optional, CropClassicTv is a React Function component. Possible (React Function component, string or HTML Element)
                            },
                            {
                                titleKey: 'cinemascope',
                                descriptionKey: '21:9',
                                ratio: 21 / 9,
                                // icon: CropCinemaScope, // optional, CropCinemaScope is a React Function component.  Possible (React Function component, string or HTML Element)
                            },
                        ],
                        // presetsFolders: [
                        //     {
                        //         titleKey: 'socialMedia', // will be translated into Social Media as backend contains this translation key
                        //         // icon: Social, // optional, Social is a React Function component. Possible (React Function component, string or HTML Element)
                        //         groups: [
                        //             {
                        //                 titleKey: 'facebook',
                        //                 items: [
                        //                     {
                        //                         titleKey: 'profile',
                        //                         width: 180,
                        //                         height: 180,
                        //                         descriptionKey: 'fbProfileSize',
                        //                     },
                        //                     {
                        //                         titleKey: 'coverPhoto',
                        //                         width: 820,
                        //                         height: 312,
                        //                         descriptionKey:'fbCoverPhotoSize',
                        //                     },
                        //                 ],
                        //             },
                        //         ],
                        //     },
                        // ],
                    }}
                    tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.WATERMARK, TABS.FILTERS, TABS.FINETUNE, TABS.RESIZE]} // or {['Adjust', 'Annotate', 'Watermark']}
                    defaultTabId={TABS.ADJUST} // or 'Annotate'
                    defaultToolId={TOOLS.CROP} // or 'Text'
                    useBackendTranslations={false}
                    avoidChangesNotSavedAlertOnLeave={true}
                    translations={{
                        name: '名称',
                        save: '保存',
                        saveAs: '另存为',
                        back: '返回',
                        loading: '加载中...',
                        resetOperations: '重置/删除所有操作',
                        cancel: '取消',
                        apply: '应用',
                        warning: '警告',
                        confirm: '确认',
                        discardChanges: '放弃更改',
                        undoTitle: '撤销上一步',
                        redoTitle: '重做上一步',
                        showImageTitle: '显示原图',
                        zoomInTitle: '放大',
                        zoomOutTitle: '缩小',
                        adjustTab: '调整',
                        finetuneTab: '微调',
                        filtersTab: '滤镜',
                        watermarkTab: '水印',
                        annotateTabLabel: '标注',
                        resize: '调整大小',
                        resizeTab: '调整大小',
                        imageName: '图片名称',
                        cropTool: '裁剪',
                        original: '原始',
                        custom: '自定义',
                        square: '正方形',
                        landscape: '横向',
                        portrait: '竖向',
                        ellipse: '椭圆',
                        classicTv: '经典电视',
                        cinemascope: '宽银幕',
                        arrowTool: '箭头',
                        blurTool: '模糊',
                        brightnessTool: '亮度',
                        contrastTool: '对比度',
                        ellipseTool: '椭圆',
                        flipX: '水平翻转',
                        unFlipX: '取消水平翻转',
                        flipY: '垂直翻转',
                        unFlipY: '取消垂直翻转',
                        hue: '色相',
                        brightness: '亮度',
                        saturation: '饱和度',
                        value: '明度',
                        imageTool: '图片',
                        importing: '导入中...',
                        addImage: '+ 添加图片',
                        uploadImage: '上传图片',
                        fromGallery: '从图库选择',
                        lineTool: '直线',
                        penTool: '画笔',
                        polygonTool: '多边形',
                        sides: '边数',
                        rectangleTool: '矩形',
                        cornerRadius: '圆角',
                        resizeWidthTitle: '宽度（像素）',
                        resizeHeightTitle: '高度（像素）',
                        toggleRatioLockTitle: '锁定比例',
                        resetSize: '恢复原始尺寸',
                        rotateTool: '旋转',
                        textTool: '文字',
                        textSpacings: '文字间距',
                        textAlignment: '文字对齐',
                        fontFamily: '字体',
                        size: '大小',
                        letterSpacing: '字间距',
                        lineHeight: '行高',
                        warmthTool: '暖度',
                        addWatermark: '+ 添加水印',
                        addTextWatermark: '+ 添加文字水印',
                        addWatermarkTitle: '选择水印类型',
                        uploadWatermark: '上传水印',
                        addWatermarkAsText: '以文字添加',
                        padding: '内边距',
                        paddings: '内边距',
                        shadow: '阴影',
                        horizontal: '水平',
                        vertical: '垂直',
                        blur: '模糊',
                        opacity: '不透明度',
                        transparency: '透明度',
                        position: '位置',
                        stroke: '描边',
                        saveAsModalTitle: '另存为',
                        extension: '扩展名',
                        format: '格式',
                        quality: '质量',
                        actualSize: '实际大小 (100%)',
                        fitSize: '适应窗口',
                        download: '下载',
                        width: '宽度',
                        height: '高度',
                        tabsMenu: '菜单',
                    }}
                />}
            </div>
        </>
    );
}
