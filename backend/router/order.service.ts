import { Hono, type Context } from "hono";
import { storageMiddleware } from "../middleware/storage";
import { ColumnGet, ColumnSet, ColumnIndex } from "../module/columns";
import { verifyUser } from "../module/verifyUser";
import { verifySetOffset, verifyGetOffset } from "../utils/verifyOffset";
import { blackboardGet } from "../module/blackboard";
import type { Blackboard, SendOrder } from "../../shared/types/api/order";
import { type HlzhjyReq, hlzhjy } from "../plugin/hlzhjy/login";

const _ = new Hono(); const column = new Hono(); const page = new Hono();
_.use('/*', (c, next) => {
    c.header('Cache-Control', `public, no-cache`); //304 public
    return next();
});

function _verifyPushColumnReq(c: Context, body: any){
    const songItem = body.songItem || {};
    const { className='', userName='', userId='' } = body;
    if(!songItem){
        return c.json({code: 206, error: 'songItem is required'}, 400);
    }
    if(!verifySetOffset(body.offsetDay)){
        return c.json({code: 202, error: 'offsetDay is required and between 1 and MAX_COLUMN-1'}, 400);
    }
    if(!verifyUser(userName, userId, className)){
        return c.json({code: 207, error: 'userName, userId, className is invalid'}, 400);
    }
}

column
    .use(storageMiddleware)
    .get('/lookup/single/v1.0', async (c) => {
        const kv = c.get('kv');
        const offsetDay = Number(c.req.query('offsetDay'));
        if (!verifyGetOffset(offsetDay))
            return c.json({code: 202, error: 'offsetDay is required and between 0 and MAX_COLUMN-1'});
        const column = await new ColumnGet(kv).getOffsetColumn(offsetDay);
        return c.json(column);
    })
    .post('/modify/push/v1.0', async (c) => {
        const kv = c.get('kv');
        const body = await c.req.json<Partial<SendOrder.Req>>();
        _verifyPushColumnReq(c, body);
        const res = await new ColumnSet(kv).setColumn(body);
        return c.json(res);
    })
    // hlzhjy.com 支持验证码模块
    .post('/modify/push/hlzhjy', async (c) => {
        const kv = c.get('kv');
        const body = await c.req.json<Partial<HlzhjyReq.Req>>();
        const {userId, userName} = await hlzhjy.getUserInfo(body);
        return c.json(await new ColumnSet(kv).setColumn({...body, userId, userName}));
    })
    .get('/index/all/v1.0', async (c) => {
        const kv = c.get('kv');
        const columns = await new ColumnIndex(kv).getAllColumn();
        // 统一 { data } 结构，前端 xfetch 解包 raw.data
        return c.json({ data: columns });
    })
;

page
    .use(storageMiddleware)
    .get('/blackboard/v1.0', async (c) => {
        const kv = c.get('kv');
        const blackboard: Blackboard = await blackboardGet(kv);
        return c.json({ data: blackboard });
    })

_.route('/page', page);
_.route('/column', column);

export default _;