import { ofetch } from "ofetch";
import { textDecrypt } from "../../shared/util/xor.ts";
import type { ApiData } from "../../shared/types/base.d.ts";

import xhrAccess from "./xhrAccess";

const xfetch = ofetch.create({
    async onRequest({ request, options }) {
        // axios 风格：支持 params 选项
        const params: Record<string, unknown> | undefined =
            (options as { params?: Record<string, unknown> }).params;
        if (params) {
            options.query = { ...params, ...options.query };
        }
        const headers = xhrAccess({ request: request as Request, options });
        options.headers = new Headers(options.headers);
        for (const [key, value] of headers.entries()) {
            options.headers.set(key, value);
        }
    },
    async onRequestError({ request, error }) {
        console.error("[xfetch] request error:", request, error);
    },
    async onResponseError({ request, response }) {
        console.error("[xfetch] response error:", request, response.status, response._data);
    },
    onResponse({ response }) {
        // 响应为 AES+XOR 加密的 base64 字符串，先解密再解析
        const decrypted = textDecrypt(response._data as string, response.headers.get('X-Encrypt-Key') || '');
        const raw = JSON.parse(decrypted) as ApiData<any>;
        console.log(raw);
        const code = raw.code;
        if (code !== 0) {
            console.error("[xfetch] api error:", raw.error);
        }
        // ofetch 会忽略 onResponse 返回值，必须直接修改 _data 来解包
        response._data = raw.data;
    }
});

export default xfetch;
