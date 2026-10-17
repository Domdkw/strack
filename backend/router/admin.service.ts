import { Hono } from "hono";
import { signAccess } from "../middleware/reqAccess";
import { storageMiddleware } from "../middleware/storage";
import { adminVerify, jwtSign, jwtAuth } from "../middleware/adminMiddleware";
import type { deleteColumnRowReq } from "../../shared/types/api/order";

import ColumnDel from "../module/columns/ColumnDel";

const admin = new Hono(); const auth = new Hono();

admin.use(signAccess);

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
        return c.json({
            data: {
                token,
                timestamp: Date.now().toString(),
                role: "admin",
                type: "jwt",
            },
        });
    });
;

admin
    .use(jwtAuth)
    .use(storageMiddleware)
    .post('/column-row/delete/v1.0', async (c) => {
        const kv = c.get("kv");
        const req = await c.req.json<deleteColumnRowReq>();
        const res = await new ColumnDel(kv).deleteColumnRow(req);
        return c.json(res);
    })

admin.route("/auth", auth);

export default admin;
