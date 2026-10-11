import { HmacMD5 } from "crypto-js";
import { genSalt } from "./apiUtils";
function encryptPassword(password: string, secretKey: string): string {
    return HmacMD5(password, secretKey).toString(CryptoJS.enc.Hex);
}

function doSign(body: object, path: string, secretKey: string, nonce: string): string {
    const UA = navigator.userAgent;
    const qsign = HmacMD5(
        nonce + JSON.stringify(body) + '--dm:strack/va1' + UA + path,
        secretKey
    ).toString(CryptoJS.enc.Hex);
    return qsign;
}
type Admin = {
    secretKey: string;
    name: string;
    userId: string;
    password: string;
    schoolName: string;
}
function adminBody(body: object, path: string): object {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}') as Admin;
    const secretKey = admin.secretKey || '';
    const nonce = genSalt();
    const reqBody = {
        ...body,
        name: admin.name || '',
        userId: admin.userId || '',
        password: admin.password || '',
        schoolName: admin.schoolName || '',
        nonce,
    }
    const sign = doSign(reqBody, path, secretKey, nonce);
    return {
        ...reqBody,
        sign,
    }
}