import { Hono } from "hono";
import { signAccess } from "../middleware/reqAccess";
import { storageMiddleware } from "../middleware/storage";
import { getOffsetColumn, setColumn, getAllColumn } from "../module/columnCache";
import { verifyAll } from "../module/verifyUser";

const _ = new Hono(); const column = new Hono();

_.use(signAccess); // order service 全局

column
    .use(storageMiddleware)
    .get('/lookup/single/v1.0', async (c) => {
        const kv = c.get('kv');
        const offsetDay = Number(c.req.query('offsetDay'));
        if (!Number.isInteger(offsetDay) || offsetDay < 0 || offsetDay > 21)
            return c.json({
                code: 202,
                error: 'offsetDay is required and between 0 and 21',
            });
        const column = await getOffsetColumn(offsetDay, kv);
        return c.json(column);
    })
    .post('/modify/update/v1.0', async (c) => {
        const kv = c.get('kv');
        const body = await c.req.json();
        const songItem = body.songItem || {};
        const { className='', userName='', userId='' } = body;
        if(!songItem){
            return c.json({code: 206, error: 'songItem is required'});
        }
        if(!Number.isInteger(body.offsetDay) || body.offsetDay < 1 || body.offsetDay > 21){
            return c.json({code: 202, error: 'offsetDay is required and between 1 and 21'});
        }

        if(!verifyAll(userName, userId, className)){
            return c.json({code: 207, error: 'userName, userId, className is invalid'});
        }
        const res = await setColumn(body, kv);
        return c.json(res);
    })
    .get('/lookup/index/all/v1.0', async (c) => {
        const kv = c.get('kv');
        const columns = await getAllColumn(kv);
        // 统一 { data } 结构，前端 xfetch 解包 raw.data
        return c.json({ data: columns });
    })
;
_.route('/column', column);

export default _;