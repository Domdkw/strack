/**
 * Bun 适配器（后端入口）
 * 使用 `bun run backend/adapter/bun.ts` 启动
 */
import app from '../app';

const port: number = Number(process.env.PORT) || 3200;

console.log(`Bun Server is running on http://localhost:${port}`);
console.log(`Allowed CORS origins: ${process.env.ALLOWED_ORIGINS || 'Not configured, allowing all origins'}`);

Bun.serve({
    port,
    fetch: app.fetch,
});

export default app;
