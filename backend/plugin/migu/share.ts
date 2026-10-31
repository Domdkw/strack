import { ofetch } from "ofetch";
import type { ShareParse } from "../../../shared/types/api/music";
import getHost from "../../utils/getHost";

export async function miguShare({shareUrl, host}: {shareUrl: string, host: string;}): Promise<ShareParse.Res.Song | null> {
    if (host === 'c.migu.cn') {
        shareUrl = await (async(url: string): Promise<string>=>{
            const res = await ofetch(url, {
                method: 'HEAD',
            });
            return res.headers.get('Location') || url;
        })(shareUrl)
    }
    if (getHost(shareUrl) !== 'h5.nf.migu.cn') {
        return null;
    }
    if(!shareUrl.includes('/song-new/')) {
        return null;
    }
    const queryParams = Object.fromEntries(
        decodeURIComponent(shareUrl)
            .slice(shareUrl.indexOf("?") + 1)
            .split("&")
            .map((t) => t.split("=")),
    ) as {id: string|number, targetUserName?: string};
    return {
        ...queryParams,
        id: String(queryParams.id),
        platform: 'migu',
    };
}