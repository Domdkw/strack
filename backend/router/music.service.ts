import { Hono } from "hono";
import { platformAccess, Platform, signAccess } from "../middleware/reqAccess";
import { musicSearch } from "../module/musicSearch";
import { musicUrl } from "../module/musicUrl";
import CryptoJS from "crypto-js";
import type { Context } from "hono";

const _ = new Hono();
const [search, strategy] = [
    new Hono(), new Hono(),
];
// end

_.use(platformAccess);

search
    .get('/song/v1.0', async (c) => {
        const { text, page, size, platform } = c.req.query();
        const res = await musicSearch[platform as Platform](text, Number(page), Number(size));
        return c.json({ code: 0, ...res } as any);
    });
;

const _getMusicUrl = async (c: Context) => {
    const { id, isVip, extStr, platform } = c.req.query();
    const ext = extStr ? JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(extStr))) : {}, vip = !!isVip;
    return await musicUrl[platform as Platform](id, ext, vip);
}

strategy
    .use(signAccess)
    .get('/listen/url/v1.0', async (c) => c.json({
        code: 0,
        data: await _getMusicUrl(c)
    }))
    //.get('/listen/302/v1.0', async (c) => {
    //    c.redirect((await _getMusicUrl(c)).url || '', 302);
    //})
;

// route start
_.route('/search', search);
_.route('/strategy', strategy);

export default _;
