import zhCn from '@i18n/zh-CN/index';

export const languages = {
    'zh-CN': zhCn
}

export const getLocale = () => 'zh-CN';

export const getLang = () => zhCn;

export const getBrowserType = (userAgent) => {
    if (!userAgent) return 'Unknown';
    const browserRegexes = [
        { name: 'Edge', regex: /Edg\/(\d+)/ },
        { name: 'Chrome', regex: /Chrome\/(\d+)/ },
        { name: 'Safari', regex: /Safari\/(\d+)/ },
        { name: 'Firefox', regex: /Firefox\/(\d+)/ },
        { name: 'Opera', regex: /OPR\/(\d+)/ },
        { name: 'IE', regex: /Trident\/(\d+)/ },
    ];
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
        return 'Safari';
    }
    for (let i = 0; i < browserRegexes.length; i++) {
        const match = userAgent.match(browserRegexes[i].regex);
        if (match) {
            return browserRegexes[i].name;
        }
    }
    return 'Unknown';
}
