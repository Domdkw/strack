import type { ShareParse } from "../../../shared/types/api/music";
import getHost from "../../utils/getHost";
import resolveShortUrl from "../../utils/resolveShortUrl";

export async function ncmShare({shareUrl, host}: {shareUrl: string, host: string}): Promise<ShareParse.Res.Song | null> {
    // 短链还原：163cn.tv -> music.163.com
    if (host === '163cn.tv') {
        shareUrl = await resolveShortUrl(shareUrl);
        host = getHost(shareUrl).toLowerCase();
    }
    if (!/^(?:[a-z0-9-]+\.)?music\.163\.com$/.test(host)) return null;
    // 支持 /song?id=xxx、/#/song?id=xxx、/outchain/2/xxx、/song/xxx
    const id = shareUrl.match(/song\?id=(\d+)/)?.[1]
        ?? shareUrl.match(/outchain\/2\/(\d+)/)?.[1]
        ?? shareUrl.match(/music\.163\.com\/song\/(\d+)/)?.[1];
    if (!id) return null;
    return {
        id,
        platform: 'ncm',
    };
}
