import { Hono } from "hono";
import { signAccess, platformAccess, type Platform } from "../middleware/reqAccess";

const [ _, lookup] = [ new Hono(), new Hono() ];

_.use(signAccess); // order service 全局

lookup
    .get('/date/v1.0', async (c) => {
        return c.json({
            code: 0,
            msg: 'success',
        });
    })

_.route('/lookup', lookup);

export default _;