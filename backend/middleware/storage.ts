import { createStorage } from "unstorage";
import cloudflareKVBindingDriver from "unstorage/drivers/cloudflare-kv-binding";
import type { Storage } from "unstorage";
import { createMiddleware } from "hono/factory";

/**
 * 获取 Cloudflare KV 存储实例（单例）
 * 绑定名 CF_KV 需在 wrangler.jsonc 的 kv_namespaces 中配置
 */
export function getKv(env: { CF_KV: KVNamespace }): Storage {
    return createStorage({
        driver: cloudflareKVBindingDriver({ binding: env.CF_KV }),
    });
}

type Env = {
    Bindings: { CF_KV: KVNamespace };
    Variables: { kv: Storage };
};

export const storageMiddleware = createMiddleware<Env>(async (c, next) => {
    const kv = getKv(c.env);
    if (!kv)
        return c.json({
            code: 201,
            error: 'kv is required',
        });
    c.set('kv', kv);
    await next();
});
