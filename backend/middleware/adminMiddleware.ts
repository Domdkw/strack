import { createMiddleware } from "hono/factory";
import { verify, sign } from 'hono/jwt';
import type { AdminReq } from "../../shared/types/api/order";
import { env } from 'hono/adapter';
import CryptoJS, { HmacMD5 } from "crypto-js";
import { Context } from "hono";
import { getCookie } from "hono/cookie";

import { verifyUserId } from "../module/verifyUser";

type Env = {
    Variables: { adminBody: AdminReq; jwtPayload: Record<string, unknown> };
    Bindings: {
        JWT_SECRET_KEY: string;
        ADMIN_NAME: string;
        ADMIN_PASSWORD: string;
        ADMIN_SECRET_KEY: string;
        SCHOOL_NAME: string;
    };
};


const ADMIN_REQ_KEY = ['name', 'userId', 'password', 'schoolName', 'sign', 'nonce'];
export function verifyAdminReq(c: Context, body: AdminReq) {
    const { name, userId, password, schoolName, sign, nonce } = body;
    if(!ADMIN_REQ_KEY.every(key => (body as Record<string, unknown>)[key])){
        return false;
    }
    const timestamp = c.req.header('X-Timestamp');
    if(!timestamp || Date.now() - Number(timestamp) > 1000 * 30){ // 30秒内有效
        return false;
    }
    const UA = c.req.header('User-Agent');
    if(!UA) return false;
    if(!verifyUserId(userId)){
        return false;
    }
    delete (body as { sign?: string }).sign;
    const qsign = HmacMD5(
        nonce + JSON.stringify(body) + '--dm:strack/va1' + UA + c.req.path,
        env(c).ADMIN_SECRET_KEY
    ).toString(CryptoJS.enc.Hex);
    if(qsign !== sign){
        return false;
    }
    const { ADMIN_NAME, ADMIN_PASSWORD, SCHOOL_NAME } = env<{ADMIN_NAME: string, ADMIN_PASSWORD: string, SCHOOL_NAME: string}>(c);
    if(name !== ADMIN_NAME || password !== HmacMD5(ADMIN_PASSWORD, env(c).ADMIN_SECRET_KEY).toString(CryptoJS.enc.Hex) || schoolName !== SCHOOL_NAME){
        return false;
    }
    return true;
}


export const JWT_EXPIRES_SEC = 60 * 60 * 2; // JWT 默认有效期 2 小时
const getJwtSecret = (c: { env: Env['Bindings'] }): string => {
    return c.env.JWT_SECRET_KEY;
};

//从 Authorization: Bearer <token> 中验证 JWT，
//通过后将 payload 写入 c.get('jwtPayload')。
export const jwtAuth = createMiddleware<Env>(async (c, next) => {
    let token = getCookie(c, 'stracktoken');
    if (!token) {
        token = c.req.header('Authorization');
        if (!token?.startsWith('Bearer ')) {
            return c.json({code: 301, error: 'token not found'}, 401);
        }
        token = token.slice('Bearer '.length);
    }

    const secret = getJwtSecret(c);
    if (!secret) {
        return c.json({code: 302, error: 'jwt secret key not found'}, 500);
    }

    try {
        const payload = await verify(token, secret, 'HS256');
        if (!payload) {
            return c.json({code: 303, error: 'token error'}, 401);
        }
        c.set('jwtPayload', payload);
        await next();
    } catch {
        // verify 抛出异常：签名不匹配 / token 已过期 / 格式错误
        return c.json({code: 304, error: 'token error'}, 401);
    }
});


//签发 JWT。payload 会被附加 exp（过期时间）与 iat（签发时间）。
export const jwtSign = async (c: { env: Env['Bindings'] }, payload: Record<string, unknown>): Promise<string> => {
    const secret = getJwtSecret(c);
    if (!secret) {
        throw new Error('jwt secret key not found');
    }
    const now = Math.floor(Date.now() / 1000);
    return sign(
        { ...payload, iat: now, exp: now + JWT_EXPIRES_SEC },
        secret,
        'HS256'
    );
};

// 管理员登录：校验请求体
export const adminVerify = createMiddleware<Env>(async (c, next) => {
    const body = await c.req.json<AdminReq>();
    if (!verifyAdminReq(c, body)) {
        return c.json({code: 305, error: 'admin permission denied'}, 301);
    }
    c.set('adminBody', body);
    await next();
});
