import { Hono } from "hono";
import { signAccess } from "../middleware/reqAccess";
import { storageMiddleware } from "../middleware/storage";
import { adminMiddleware } from "../middleware/adminMiddleware";

const admin = new Hono();

admin
    .use(signAccess)
    .use(storageMiddleware)
    .use(adminMiddleware)
;

admin;

export default admin;
