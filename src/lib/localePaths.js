const normalizePath = (path = '/') => {
    if (!path || path === '/') return '/';
    return `/${path.replace(/^\/+|\/+$/g, '')}`;
};

export const getRelativeLocaleUrl = (locale = 'zh-CN', path = '/') => {
    return normalizePath(path);
};
