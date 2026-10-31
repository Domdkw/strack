import type { ShareParse } from "../../../shared/types/api/music";
import getHost from "../../utils/getHost";
import resolveShortUrl from "../../utils/resolveShortUrl";

export async function bilibiliShare({shareUrl, host}: {shareUrl: string, host: string}): Promise<ShareParse.Res.Song | null> {
    // 短链还原：b23.tv -> www.bilibili.com
    if (host === 'b23.tv') {
        shareUrl = await resolveShortUrl(shareUrl);
        host = getHost(shareUrl).toLowerCase();
    }
    if (!/^(?:[a-z0-9-]+\.)?bilibili\.com$/.test(host)) return null;
    // 支持 /video/BVxxxx、/video/avxxxx
    const bvid = shareUrl.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1];
    const aid = !bvid ? shareUrl.match(/\/video\/av(\d+)/)?.[1] ?? shareUrl.match(/[?&]aid=(\d+)/)?.[1] : undefined;
    if (!bvid && !aid) return null;
    return {
        id: bvid ?? aid!,
        platform: 'bilibili',
        ...(bvid ? {bvid} : {}),
        ...(aid ? {aid: String(aid)} : {}),
    };
}
