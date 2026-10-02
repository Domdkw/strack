import CryptoJS from "crypto-js";

function encryptLrcUrl(url: string, key: string) {
    const keyU8 = CryptoJS.enc.Utf8.parse(key.padEnd(16, '0'));
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.Rabbit.encrypt(url, keyU8, { iv }).toString();
    const hexIv = iv.toString(CryptoJS.enc.Hex);
    return ['url', hexIv, encrypted].join(':');
}

function decryptLrcUrl(url: string, key: string) {
    const [type, hexIv, encrypted] = url.split(':');
    if (type !== 'url')
        return url;

    const iv = CryptoJS.enc.Hex.parse(hexIv);
    const keyU8 = CryptoJS.enc.Utf8.parse(key.padEnd(16, '0'));
    const decrypted = CryptoJS.Rabbit.decrypt(encrypted, keyU8, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
export { encryptLrcUrl, decryptLrcUrl };