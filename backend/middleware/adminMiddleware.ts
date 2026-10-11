import { createMiddleware } from "hono/factory";
import { verifyAdmin } from "../module/verifyUser";

export const adminMiddleware = createMiddleware(async (c, next) => {
    const body = await c.req.json();
    if(!verifyAdmin(c, body)){
        return c.json({code: 301, error: 'admin permission denied'});
    }
    c.set('adminBody', body);
    await next();
});