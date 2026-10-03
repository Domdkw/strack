/**
 * Pages Functions 入口（文件路由）
 * functions/api/[[route]].ts → 只接管 /api/* 请求
 * 其余路径仍由 Pages 静态资源 + SPA 兜底处理
 *
 * 注意：app 内部已通过 app.route('/api', ...) 挂载业务路由，
 * 且本文件只会收到 /api/* 请求，因此这里直接透传 app，不要再加 basePath，
 * 否则会变成 /api/api/... 导致全部 404。
 */
import { handle } from 'hono/cloudflare-pages';
import app from '../../backend/app';

export const onRequest = handle(app);
