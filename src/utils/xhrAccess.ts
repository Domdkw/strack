import { signV001 } from "../../shared/util/sign/v001";
import { type XhrAccessContext, genUUID, genSalt } from "./apiUtils";

function xhrAccess({ request, options }: XhrAccessContext): Headers {
    // ofetch 传入字符串 URL 时 request 不是 Request 实例，需统一处理
    const rawUrl: string = typeof request === 'string' ? request : request.url;
    const qIndex: number = rawUrl.indexOf('?');
    const url: string = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
    const query: Record<string, unknown> = options.query ?? {};
    // 服务端 c.req.query() 的值都是字符串，客户端签名前需同样转成字符串才能对上
    const stringQuery: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
            stringQuery[k] = String(v);
        }
    }
    const newHeader: Headers = new Headers(typeof request === 'string' ? undefined : request.headers);
    newHeader.set('X-SignVersion', 'v001');
    const timestamp: string = Date.now().toString();
    newHeader.set('X-Timestamp', timestamp);
    const salt: string = genSalt();
    newHeader.set('X-Salt', salt);
    const sign: string = signV001.doSign(url, stringQuery, timestamp, salt);
    newHeader.set('X-Sign', sign);
    const uuid: string = genUUID();
    newHeader.set('X-ba', `v1:${uuid}`);
    return newHeader;
}

export default xhrAccess;
