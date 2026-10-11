import { Context } from "hono";
import type { AdminReq } from "../../shared/types/api/order";
import { env } from 'hono/adapter';
import { HmacMD5 } from "crypto-js";


export function verifyName(name: string) {
    if(!name){
        return false;
    }
    const len = name.length;
    if(len < 2 || len > 10){
        return false;
    }
    for(let i=0; i<len; i++){
        const c = name[i];
        if(!/^[\u4e00-\u9fa5]/.test(c)){
            return false;
        }
    }
    return true;
}
export function verifyUserId(userid: string) {
    if(!userid){
        return false;
    }
    if(userid.length !== 13 && userid.length !== 10){
        return false;
    }
    return true;
}
export function verifyClassName(className: string) {
    if(!className || className.length !== 3){
        return false;
    }
    const c = className.slice(1, 3), d = className[0];// 0xx
    if(!['3', '1', '2'].includes(d)){
        return false;
    }
    if(Number(c) < 0 || Number(c) > 30){
        return false;
    }
    return true;
}

export function verifyUser(name: string, userId: string, className: string) {
    return verifyName(name) && verifyUserId(userId) && verifyClassName(className);
}

const ADMIN_REQ_KEY = ['name', 'userId', 'password', 'schoolName', 'sign', 'accessKey'];
export function verifyAdmin(c: Context, body: AdminReq) {
    const { name, userId, password, schoolName, sign, nonce } = body;
    if(!ADMIN_REQ_KEY.every(key => body[key])){
        return false;
    }
    const timestamp = c.req.header('X-Timestamp');
    if(!timestamp || Date.now() - Number(timestamp) > 1000 * 15){ // 15秒内有效
        return false;
    }
    const UA = c.req.header('User-Agent');
    if(!UA) return false;
    if(!verifyUserId(userId)){
        return false;
    }
    delete body.sign;
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
