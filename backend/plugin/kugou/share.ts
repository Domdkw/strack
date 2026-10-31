import type { ShareParse } from "../../../shared/types/api/music";
import getHost from "../../utils/getHost";
import resolveShortUrl from "../../utils/resolveShortUrl";

export async function kugouShare({shareUrl, host}: {shareUrl: string, host: string}): Promise<ShareParse.Res.Song | null> {
    // 短链还原：t1.kugou.com -> www.kugou.com
    if (/^t\d\.kugou\.com$/.test(host)) {
        shareUrl = await resolveShortUrl(shareUrl);
        host = getHost(shareUrl).toLowerCase();
    }
    if (!/^(?:[a-z0-9-]+\.)?kugou\.com$/.test(host)) return null;
    // 支持 ?hash=xxx、/song/#hash=xxx、/mixsong/xxx.html
    const hash = shareUrl.match(/[?&#]hash=([0-9A-Za-z]+)/)?.[1]
        ?? shareUrl.match(/\/mixsong\/([0-9A-Za-z]+)\.html/)?.[1];
    if (!hash) return null;
    return {
        id: hash,
        platform: 'kugou',
        hash,
    };
}
