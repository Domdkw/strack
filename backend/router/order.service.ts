import { Hono } from "hono";
import { signAccess } from "../middleware/reqAccess";
import { storageMiddleware } from "../middleware/storage";
import { getOffsetColumn } from "../module/columnCache";

const _ = new Hono(); const lookup = new Hono();

_.use(signAccess); // order service 全局

lookup
    .use(storageMiddleware)
    .get('/column/single/v1.0', async (c) => {
        const kv = c.get('kv');
        const offsetDay = Number(c.req.query('offsetDay')) || 0;
        if (!offsetDay || offsetDay < 0 || offsetDay > 31)
            return c.json({
                code: 202,
                error: 'offsetDay is required and between 0 and 31',
            });
        const column = await getOffsetColumn(offsetDay, kv);
        return c.json(column);
    })

_.route('/lookup', lookup);

export default _;