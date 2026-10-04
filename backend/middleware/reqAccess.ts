import { createMiddleware } from "hono/factory";
import { signV001 } from '../../shared/util/sign/v001';
import { type Platform, platforms } from '../../shared/types/base';

export const signVersions = ['v001'] as const;
export type SignVersion = (typeof signVersions)[number];



const platformAccess = createMiddleware(async (c, next) => {
    const platform = c.req.query('platform') || c.req.header('X-Strack-Platform');
    if (!platform || !platforms.includes(platform as Platform)) {
        return c.json({ code: 101, error: 'platform is required' }, 400);
    }
    await next();
});

const signAccess = createMiddleware(async (c, next) => {
    c.header('X-SignResult', 'failed');
    const timestamp = c.req.query('t') || c.req.header('X-Timestamp');
    if (!timestamp)
        return c.json({ code: 102, error: 'timestamp is required' }, 400);
    // 验证timestamp是否过5分钟
    if ((Date.now() - Number(timestamp)) > 1000 * 60 * 5)
        return c.json({ code: 103, error: 'timestamp is expired' }, 400);
    const salt = c.req.header('X-Salt') || c.req.query('qsalt') || '';
    if (!salt)
        return c.json({ code: 104, error: 'salt is required' }, 400);
    let signVersion = c.req.header('X-SignVersion') || c.req.query('qsignVersion') || '';
    if (!signVersion)
        return c.json({ code: 105, error: 'signVersion is required' }, 400);
    signVersion = signVersion.toLowerCase();
    const sign = c.req.header('X-Sign') || c.req.query('qsign');
    if (!sign)
        return c.json({ code: 106, error: 'sign is required' }, 400);
    /// === end

    // 验证sign
    const querys = c.req.query();
    // qsign 本身不参与签名，否则客户端无法预计算
    delete querys.qsign;

    let signStr = '';
    switch (signVersion) {
        case 'v001': {
            signStr = signV001.doSign(c.req.path, querys, timestamp, salt);
            break;
        }
        default:
            return c.json({ code: 107, error: 'signVersion is not supported' }, 400);
    }
    if (sign !== signStr) {
        return c.json({ code: 108, error: 'sign is invalid' }, 400);
    }

    // 验证成功，继续处理请求
    await next();

    // header返回
    c.header('X-SignResult', 'success');
});

const browserAccess = createMiddleware(async (c, next) => {
    const ba = c.req.header('X-ba');
    const uuid = ba?.split(':')[1];
    if (!uuid) {
        return c.json({ code: 109, error: 'uuid is required' }, 400);
    }
    await next();
});

export {
    platformAccess,
    signAccess,
    browserAccess,
}