import { HmacMD5, enc as CryptoJSEnc } from "crypto-js";
import { genSalt } from "./apiUtils";

// 管理员凭证：localStorage 'admin' 存储（password 为已 HmacMD5 加密后的值）
export type Admin = {
    secretKey: string;
    name: string;
    userId: string;
    password: string;
    schoolName: string;
}

// 与服务端 verifyAdminReq 对应：HmacMD5(原始密码, secretKey)
export function encryptPassword(password: string, secretKey: string): string {
    return HmacMD5(password, secretKey).toString(CryptoJSEnc.Hex);
}

function doSign(body: object, path: string, secretKey: string, nonce: string): string {
    const UA = navigator.userAgent;
    const qsign = HmacMD5(
        nonce + JSON.stringify(body) + '--dm:strack/va1' + UA + path,
        secretKey
    ).toString(CryptoJSEnc.Hex);
    return qsign;
}

// 用显式传入的管理员凭证构造带 sign 的登录请求体（首次登录时 localStorage 尚无数据）
export function signAdminBody(admin: Admin, body: object, path: string): object {
    const nonce = genSalt();
    const reqBody = {
        ...body,
        name: admin.name || '',
        userId: admin.userId || '',
        password: admin.password || '',
        schoolName: admin.schoolName || '',
        nonce,
        timestamp: Date.now(),
    };
    const sign = doSign(reqBody, path, admin.secretKey || '', nonce);
    return {
        ...reqBody,
        sign,
    };
}

// 从 localStorage 读取管理员凭证并签名（登录后的管理请求用）
export function adminBody(body: object, path: string): object {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}') as Admin;
    return signAdminBody(admin, body, path);
}
