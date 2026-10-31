import type { ShareParse } from "../../../shared/types/api/music";
import getHost from "../../utils/getHost";
import resolveShortUrl from "../../utils/resolveShortUrl";

export async function kuwoShare({shareUrl, host}: {shareUrl: string, host: string}): Promise<ShareParse.Res.Song | null> {
    // 短链还原：h5app.kuwo.cn/m/link 等中转链
    if (!/^(?:m|www)\.kuwo\.cn$/.test(host)) {
        shareUrl = await resolveShortUrl(shareUrl);
        host = getHost(shareUrl).toLowerCase();
    }
    if (!/^(?:[a-z0-9-]+\.)?kuwo\.cn$/.test(host)) return null;
    // 支持 ?musicId=xxx、?mid=xxx、?rid=MUSIC_xxx、?id=xxx、/yinyue/xxx
    const id = shareUrl.match(/[?&](?:musicId|mid)=(\d+)/)?.[1]
        ?? shareUrl.match(/[?&]rid=MUSIC_(\d+)/)?.[1]
        ?? shareUrl.match(/[?&]id=(\d+)/)?.[1]
        ?? shareUrl.match(/kuwo\.cn\/yinyue\/(\d+)/)?.[1];
    if (!id) return null;
    return {
        id,
        platform: 'kuwo',
    };
}
