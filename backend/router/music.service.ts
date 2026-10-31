import { Hono } from "hono";
import type { Platform } from "../../shared/types/base";
import { platformAccess, /*signAccess*/ } from "../middleware/reqAccess";
import { musicSearch, musicSearchV2 } from "../module/musicSearch";
import { musicUrl } from "../module/musicUrl";
import { musicInfo } from "../module/musicInfo";
import { enc } from "crypto-js";
import type { Context } from "hono";
import { memCache } from 'hono-mem-cache';
import ShareParser from '../module/shareParser';

const _ = new Hono();
const [search, strategy] = [
    new Hono(), new Hono(),
];
_.use(
    '/*',
    memCache({
        max: 100,
        ttl: 5 * 60 * 1000,
    })
);

_.use('/*', (c, next) => {
    c.header('Cache-Control', `public, s-maxage=3600, max-age=3600`); //304 public cdn
    return next();
});

// end

search
    .use(platformAccess)
    .get('/song/v1.0', async (c) => { try{
        const { text, page, size, platform } = c.req.query();
        return c.json({ code: 0, ...(await musicSearch[platform as Platform](text, Number(page), Number(size))) } as any);
    }catch(_){ return c.json({ code: 217, error: 'search failed' })}})
    .get('/song/v2.0', async (c) => { try{
        const { text, page, size, platform } = c.req.query();
        const res: {data: object[]; isEnd: boolean; setting?: object;} = await musicSearchV2[platform as Platform](text, Number(page), Number(size));
        return c.json({ code: 0, data: { list: res.data || [], isEnd: res.isEnd || false, setting: res?.setting || undefined } });
    }catch(_){ return c.json({ code: 217, error: 'search failed' })}})
;

const parseExt = (extInfo: string) => {
    return extInfo ? JSON.parse(enc.Utf8.stringify(enc.Base64.parse(extInfo))) : {};
}
const getMusicUrl = async (c: Context) => {
    const { id, isVip, extInfo, platform, fullInfo } = c.req.query();
    const ext = parseExt(extInfo), vip = !!isVip;
    return {
        ...(await musicUrl[platform as Platform](id, ext, vip)),
        ...(fullInfo === "true" || fullInfo === "1"
            ? await musicInfo[platform as Platform](id, ext)
            : {}),
    };
}
const getMusicFullInfo = async (c: Context) => {
    const { id, extInfo, platform } = c.req.query();
    const ext = parseExt(extInfo);
    return await musicInfo[platform as Platform](id, ext);
}

strategy
    .use(platformAccess)
    .get('/listen/url/v1.0', async (c) => c.json({
        code: 0,
        data: await getMusicUrl(c)
    }))
    .get('/fullinfo/v1.0', async (c) => c.json({
        code: 0,
        data: await getMusicFullInfo(c)
    }))
;

_
    .get('/share/parse/v1.0', async (c) => {
        const shareUrl = c.req.query().shareUrl || '';
        if (!shareUrl) return c.json({ code: 216, error: 'shareUrl is required' });
        return c.json({ code: 0, data: await new ShareParser().parse(shareUrl) || {error: 'parse failed'} });
    })

// route start
_.route('/search', search);
_.route('/strategy', strategy);

export default _;
