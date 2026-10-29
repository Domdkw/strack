import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { etag, RETAINED_304_HEADERS } from 'hono/etag';
import apiRoutes from './router/index';

const app = new Hono();

// 全局中间件
app.use('*', logger());

// 配置 ETag 中间件
app.use(
    '*',
    etag({
        retainedHeaders: [...RETAINED_304_HEADERS],
    })
);

// API 路由
app.route('/api', apiRoutes);

// 404 处理
app.notFound(c => {
    return c.json(
        {
            success: false,
            error: 'Not Found',
            message: '请求的资源不存在',
        },
        404
    );
});

// 全局错误处理
app.onError((err, c) => {
    return c.json(
        {
            success: false,
            error: err.message,
        },
        500
    );
});

export default app;
export type AppType = typeof app;