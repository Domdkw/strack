import { Hono } from "hono";
import { storageMiddleware } from "../middleware/storage";
import { adminVerify, jwtSign, jwtAuth, JWT_EXPIRES_SEC } from "../middleware/adminMiddleware";
import type { deleteColumnRowReq } from "../../shared/types/api/order";
import { setCookie, deleteCookie } from "hono/cookie";

import ColumnDel from "../module/columns/ColumnDel";
import ColumnAvailable from "../module/columns/ColumnAvailable";

const admin = new Hono();

// 登录组：仅 adminVerify 请求体签名校验，不能挂 jwtAuth（否则未登录永远拿不到 token）
const auth = new Hono();
auth
    .use(adminVerify)
    .post("/login", async (c) => {
        const body = c.get("adminBody");
        const token = await jwtSign(c, {
            name: body.name,
            userId: body.userId,
            role: "admin",
        });
        // 登录成功后在响应头中返回 token
        c.header("X-Auth-Token", token);
        c.header("X-Timestamp", Date.now().toString());
        // httpOnly Cookie：浏览器自动携带，path 必须为 '/' 否则其他 /api 路径收不到
        setCookie(c, "stracktoken", token, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            path: "/",
            maxAge: JWT_EXPIRES_SEC, // hono maxAge 单位为秒
        });
        return c.json({
            data: {
                token,
                timestamp: Date.now().toString(),
                role: "admin",
                type: "jwt",
            },
        });
    });

// 管理组：jwtAuth 只挂在这个子应用上，不影响 /auth/login
const manage = new Hono();
manage
    .use(jwtAuth)
    .use(storageMiddleware)
    .post('/auth/logout', (c) => {
        // 退出登录：清除 JWT Cookie
        deleteCookie(c, 'stracktoken', { path: '/' });
        return c.json({ data: { ok: true } });
    })
    .post('/column/row/delete/v1.0', async (c) => {
        const kv = c.get("kv");
        const req = await c.req.json<deleteColumnRowReq>();
        const res = await new ColumnDel(kv).deleteColumnRow(req);
        return c.json(res);
    })
    .post('/column/available/v1.0', async (c) => {
        const kv = c.get("kv");
        const req = await c.req.json<{offsetDay: number, disabled: boolean}[]>();
        const res = await new ColumnAvailable(kv).changeUseable(req);
        return c.json(res);
    });

admin.route("/auth", auth);
admin.route("/", manage);

export default admin;
