import { Hono } from "hono";
import { storageMiddleware } from "../middleware/storage";
import { ColumnGet, ColumnSet, ColumnIndex } from "../module/columns";
import { verifyUser } from "../module/verifyUser";
import { MAX_COLUMN } from "../module/columns/common";

const _ = new Hono(); const column = new Hono();

column
    .use(storageMiddleware)
    .get('/lookup/single/v1.0', async (c) => {
        const kv = c.get('kv');
        const offsetDay = Number(c.req.query('offsetDay'));
        if (!Number.isInteger(offsetDay) || offsetDay < 0 || offsetDay > MAX_COLUMN-1)
            return c.json({
                code: 202,
                error: 'offsetDay is required and between 0 and MAX_COLUMN-1',
            });
        const column = await new ColumnGet(kv).getOffsetColumn(offsetDay);
        return c.json(column);
    })
    .post('/modify/push/v1.0', async (c) => {
        const kv = c.get('kv');
        const body = await c.req.json();
        const songItem = body.songItem || {};
        const { className='', userName='', userId='' } = body;
        if(!songItem){
            return c.json({code: 206, error: 'songItem is required'});
        }
        if(!Number.isInteger(body.offsetDay) || body.offsetDay < 1 || body.offsetDay > MAX_COLUMN-1){
            return c.json({code: 202, error: 'offsetDay is required and between 1 and MAX_COLUMN-1'});
        }

        if(!verifyUser(userName, userId, className)){
            return c.json({code: 207, error: 'userName, userId, className is invalid'});
        }
        const res = await new ColumnSet(kv).setColumn(body);
        return c.json(res);
    })
    .get('/index/all/v1.0', async (c) => {
        const kv = c.get('kv');
        const columns = await new ColumnIndex(kv).getAllColumn();
        // 统一 { data } 结构，前端 xfetch 解包 raw.data
        return c.json({ data: columns });
    })
;

_.route('/column', column);

export default _;