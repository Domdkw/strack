import { Hono } from "hono";
import { browserAccess } from "../middleware/reqAccess";
import { commonResWrapper } from "../middleware/resWrapper";

import musicService from './music.service';
import orderService from './order.service';

const router = new Hono();

router.use(browserAccess);
router.use(commonResWrapper);

router.route('/music', musicService);
router.route('/order', orderService);

export default router;
