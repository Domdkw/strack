/**
 * Cloudflare Pages 适配器
 * 用于部署到 Cloudflare Pages
 */
import app from '../app';

// Cloudflare Pages 绑定类型声明（与 wrangler.jsonc 中的配置保持一致）
export type Bindings = {
    CF_KV: KVNamespace;
    ALLOWED_ORIGINS: string;
};

export default app;
