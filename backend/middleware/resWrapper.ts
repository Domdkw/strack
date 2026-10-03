import { createMiddleware } from "hono/factory";
import pkg from '../../package.json' with { type: "json" };

const commonResWrapper = createMiddleware(async (c, next) => {
    await next();
    c.res.headers.set("X-Timestamp", Date.now().toString());
    c.res.headers.set('Cache-Control', `private, no-cache`); //必走304
    c.res.headers.set('X-Strack-v', pkg.version);

    try {
        const rawJson = await c.res.json() as Record<string, unknown> & { code?: number };
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