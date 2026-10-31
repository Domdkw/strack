// 跟随 302 跳转，还原短链真实地址
// 注意：须用原生 fetch（ofetch 会自动跟随跳转导致拿不到 Location）
export default async function resolveShortUrl(url: string, maxRedirects = 5): Promise<string> {
    let current = url;
    for (let i = 0; i < maxRedirects; i++) {
        let res = await fetch(current, {method: 'HEAD', redirect: 'manual'}).catch(() => undefined);
        // 部分短链服务禁用 HEAD，回退 GET
        if (!res || res.status >= 400) {
            res = await fetch(current, {redirect: 'manual'});
        }
        const location = res.headers.get('location');
        if (!location) return current;
        current = new URL(location, current).toString();
    }
    return current;
}
