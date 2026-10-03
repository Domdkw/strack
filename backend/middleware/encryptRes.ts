import { createMiddleware } from "hono/factory";
import { textEncrypt } from '../../shared/util/xor.ts';

/**
 * 全局响应加密中间件
 * 将 JSON 响应体经 textEncrypt（XOR + AES-ECB）加密后以纯文本返回，
 * 前端 xfetch 的 onResponse 中调用 textDecrypt 解密还原。
 */
const encryptRes = createMiddleware(async (c, next) => {
    await next();
    try {
        const randomKey = Math.random().toString(36).substring(2, 10);
        const rawJson: unknown = await c.res.json();
        const encrypted = textEncrypt(JSON.stringify(rawJson), randomKey);
        c.res = new Response(encrypted, {
            status: c.res.status,
            headers: c.res.headers,
        });
        c.res.headers.set('X-Encrypt-Key', randomKey);
        c.res.headers.set('Content-Type', 'text/plain; charset=utf-8');
    } catch {
        // 非 JSON 响应（如静态资源/流）保持原样
    }
});

export default encryptRes;
