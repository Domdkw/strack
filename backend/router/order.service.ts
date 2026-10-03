import { Hono } from "hono";
import { signAccess } from "../middleware/reqAccess";
import { storageMiddleware } from "../middleware/storage";
import { getOffsetColumn, setColumn } from "../module/columnCache";
import { verifyAll } from "../module/verifyUser";

const _ = new Hono(); const column = new Hono();

_.use(signAccess); // order service 全局

column
    .use(storageMiddleware)
    .get('/lookup/single/v1.0', async (c) => {
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
    .post('/modify/update/v1.0', async (c) => {
        const kv = c.get('kv');
        const body = await c.req.json();
        const song = body.song || {};
        const { className='', userName='', userId='' } = body;
        if(!song){
            return c.json({code: 206, error: 'song is required'});
        }
        if(!verifyAll(userName, userId, className)){
            return c.json({code: 207, error: 'userName, userId, className is invalid'});
        }
        const res = await setColumn(body, kv);
        return c.json(res);
    })
;
_.route('/column', column);

export default _;