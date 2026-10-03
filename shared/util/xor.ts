import CryptoJS, { AES } from "crypto-js";

const ckey = [
    'Bhlr-nVbe/OXC?Ydg9/Lgo6SCPipvD==', 'f1k9Nlb0/UNrS=XtgpkT7Mc/NNVOaVgB'
]

const u8aKey = (pkey: string, num: number = 0) => {
    pkey = pkey.padEnd(16, '0');
    const k = ckey[num].split('').reduce((arr: string[], c: string, index: number) => {
        if(index % 6 === 0) {
            arr.push(pkey[index % 16]);
        }
        arr.push(c);
        return arr;
    }, []);
    return new TextEncoder().encode(k.join(''));
};

export const encrypt = {
    u8aToBuf: (u8a: Uint8Array) => u8a.buffer,
    
    concatU8a: (...u8as: Uint8Array[]) => {
        let totalLength = 0;
        for (const u8a of u8as) {
            totalLength += u8a.length;
        }
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const u8a of u8as) {
            result.set(u8a, offset);
            offset += u8a.length;
        }
        return result;
    },

    encryptText:(text: string, pkey: string) => {
        const q = 256;
        const originalU8a = new TextEncoder().encode(text)
        ,off1 = Math.floor(Math.random() * 256) // 随机偏移量 0-255
        ,off2 = Math.floor(Math.random() * 512)
        ,modulo = Math.floor(Math.random() * 128)
        ,dataIndex = Math.floor(((off2 + off1)/q))
        ,off3 = Math.abs((off2 - off1))%(modulo + 64);
        //console.log(off1, off2 ,off3, modulo, dataIndex);

        const offList = [
            44, (off2 + off1)%q, 80+off1, modulo-83, dataIndex
        ]
        ,ekey = u8aKey(pkey)
        ,keyLength = ekey.length
        ,headerU8a = new Uint8Array(offList)
        ,encryptedU8a = new Uint8Array(originalU8a.length);

        for (let i = 0 ; i < encryptedU8a.length; i++) {
            encryptedU8a[i] = originalU8a[i] + off3 + off1 - ekey[i % keyLength]
        }

        if (dataIndex !== 0) {
            const unsignedData = new Uint8Array(dataIndex);
            for (let i = 0 ; i < dataIndex; i++) {
                unsignedData[i] = Math.floor(Math.random() * 256);
            }
            return encrypt.concatU8a(headerU8a, unsignedData, encryptedU8a);
        }
        return encrypt.concatU8a(headerU8a, encryptedU8a);
    }
}
const decrypt = {
    //toU8: (n: number) => n & 0xFF,
    decryptU8a: (u8a: Uint8Array, pkey: string): string => {
        const ekey = u8aKey(pkey);
        const keyLength = ekey.length;
        if (u8a.length < 6)
            return '';
        if (u8a[0] !== 44)
            return '';

        let [a, b, c, d] = u8a.slice(1, 5),
        o1 = (b-80)&0xFF,
        m = (c+83)&0xFF,
        o2 = d*256+a-o1,
        o3 = Math.abs((o2 - o1))%(m + 64);
        //console.log(o1, o2, o3, m, d);
        const enData = u8a.slice(5+d, u8a.length+1);
        const deData = new Uint8Array(enData.length);
        for (let i = 0 ; i < deData.length; i++) {
            deData[i] = enData[i] - o3 - o1 + ekey[i % keyLength];
        }
        return new TextDecoder().decode(deData);
    }
}

export const textEncrypt = (text: string, pkey: string) => {
    const u8a = encrypt.encryptText(text, pkey);
    // 逐字节转二进制字符串，避免 TextDecoder 对非 UTF-8 字节的有损替换
    const encrypted = Array.from(u8a, (b: number) => String.fromCharCode(b)).join('');
    const key = CryptoJS.enc.Utf8.parse(ckey[1]);
    // 加密内容是任意二进制字节（Latin-1），必须显式按 Latin1 解析，
    // 否则默认按 UTF-8 解析会产生不同的字节序列，解密端无法还原
    return AES.encrypt(CryptoJS.enc.Latin1.parse(encrypted), key
        ,{
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7,
        }
    ).toString();
}
export const textDecrypt = (encrypted: string, pkey: string) => {
    const key = CryptoJS.enc.Utf8.parse(ckey[1]);
    const decrypted = CryptoJS.AES.decrypt(encrypted, key
        ,{
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7,
        }
    // 输出同理：解密结果是任意二进制字节，按 Latin1 还原成字符串
    // 按 Utf8 输出会在字节序列非法时抛 "Malformed UTF-8 data"
    ).toString(CryptoJS.enc.Latin1);
    const encryptedU8a = Uint8Array.from(decrypted, (c: string) => c.charCodeAt(0) & 0xFF);
    return decrypt.decryptU8a(encryptedU8a, pkey);
}
//console.log(textDecrypt(textEncrypt('hello')));
