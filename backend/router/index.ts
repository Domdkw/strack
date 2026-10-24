import { Hono } from "hono";
import { commonResWrapper } from "../middleware/resWrapper";
//import { browserAccess } from "../middleware/reqAccess";
//import { signAccess } from "../middleware/reqAccess";
import { uaBlocker } from "@hono/ua-blocker";
import { aiBots } from "@hono/ua-blocker/ai-bots";
//import encryptRes from '../middleware/encryptRes';

import musicService from './music.service';
import orderService from './order.service';
import adminService from './admin.service';

const router = new Hono();

//router.use(browserAccess);
//router.use(signAccess);
// encryptRes 须在 commonResWrapper 之前注册：
// post 处理按注册逆序执行，保证先解包 success 再加密响应体
//router.use(encryptRes);
router.use(commonResWrapper);
router.use(uaBlocker({
    blocklist: aiBots,
}));

router.route('/music', musicService);
router.route('/order', orderService);
router.route('/admin', adminService);

export default router;
