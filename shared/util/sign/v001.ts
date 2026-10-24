import { enc, HmacMD5 } from "crypto-js";
export const signV001 = {
    doSign: (path: string, paramObj:object, timestamp: string, salt: string, key: string = 'e41cc0e7ebad0e24') => {
        const paramObjStr = Object.keys(paramObj).length > 0
            ? enc.Base64.stringify(enc.Utf8.parse(JSON.stringify(paramObj)))
            : '';
        return HmacMD5(path + paramObjStr + timestamp + salt + key, key).toString(enc.Hex);
    },
}