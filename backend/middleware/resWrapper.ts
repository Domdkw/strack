import { createMiddleware } from "hono/factory";
import pkg from '../../package.json' with { type: "json" };

const commonResWrapper = createMiddleware(async (c, next) => {
    await next();
    c.res.headers.set("X-Timestamp", Date.now().toString());
    c.res.headers.set('X-Strack-v', pkg.version);

    // 仅处理 JSON 响应，避免读取 HTML / 流响应体导致 ReadableStream 被锁定
    const contentType = c.res.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json')) return;

    try {
        const rawJson = await c.res.json() as Record<string, unknown> & { code?: number };
        if (rawJson.code === undefined){
            rawJson.code = 0;
        }
        if ('code' in rawJson) {
            rawJson.success = rawJson.code === 0 || rawJson.code === undefined;
        }

        c.res = new Response(JSON.stringify(rawJson), {
            status: c.res.status,
            headers: c.res.headers,
        });
    } catch (error) {
        //console.error("[commonResWrapper] error:", error);
    }
});
export {
    commonResWrapper,
}