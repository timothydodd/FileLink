// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createQueryParams = (params: any) => {
    return Object.keys(params)
        .filter(k => typeof params[k] !== 'undefined')
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
};
