import { Hono } from "hono";
import type { Platform } from "../../shared/types/base";
import { platformAccess, signAccess } from "../middleware/reqAccess";
import { musicSearch } from "../module/musicSearch";
import { musicUrl } from "../module/musicUrl";
import { musicInfo } from "../module/musicInfo";
import CryptoJS from "crypto-js";
import type { Context } from "hono";
import { memCache } from 'hono-mem-cache';

const _ = new Hono();
const [search, strategy] = [
    new Hono(), new Hono(),
];
_.use(
    '*',
    memCache({
        max: 100,
        ttl: 5 * 60 * 1000,
    })
);

// end

_.use(platformAccess);

search
    .get('/song/v1.0', async (c) => {
        const { text, page, size, platform } = c.req.query();
        const res = await musicSearch[platform as Platform](text, Number(page), Number(size));
        return c.json({ code: 0, ...res } as any);
    });
;

const parseExt = (extInfo: string) => {
        return extInfo ? JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(extInfo))) : {};
}
const getMusicUrl = async (c: Context) => {
    const { id, isVip, extInfo, platform, fullInfo } = c.req.query();
    const ext = parseExt(extInfo), vip = !!isVip;
    return {
        ...(await musicUrl[platform as Platform](id, ext, vip)),
        ...(Boolean(fullInfo) ? await musicInfo[platform as Platform](id, ext) : {})
    };
}
const getMusicFullInfo = async (c: Context) => {
    const { id, extInfo, platform } = c.req.query();
    const ext = parseExt(extInfo);
    return await musicInfo[platform as Platform](id, ext);
}

strategy
    .use(signAccess)
    .get('/listen/url/v1.0', async (c) => c.json({
        code: 0,
        data: await getMusicUrl(c)
    }))
    //.get('/listen/302/v1.0', async (c) => {
    //    c.redirect((await _getMusicUrl(c)).url || '', 302);
    //})
    .get('/fullinfo/v1.0', async (c) => c.json({
        code: 0,
        data: await getMusicFullInfo(c)
    }))
;

// route start
_.route('/search', search);
_.route('/strategy', strategy);

export default _;
