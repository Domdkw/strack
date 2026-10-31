import type { Platform } from "../../shared/types/base";
import type { ShareParse } from "../../shared/types/api/music";
import { miguShare } from "../plugin/migu/share";
import { ncmShare } from "../plugin/ncm/share";
import { kugouShare } from "../plugin/kugou/share";
import { kuwoShare } from "../plugin/kuwo/share";
import { bilibiliShare } from "../plugin/bilibili/share";
import getHost from "../utils/getHost";

type ShareFn = (args: {shareUrl: string, host: string}) => Promise<ShareParse.Res.Song | null>;

const platformShareIndex: Record<Platform, ShareFn> = {
    migu: miguShare,
    ncm: ncmShare,
    kugou: kugouShare,
    kuwo: kuwoShare,
    bilibili: bilibiliShare,
}

const platformRegex: ReadonlyArray<readonly [RegExp, string]> = [
    [/^(?:[a-z0-9-]+\.)?music\.163\.com$/, 'ncm'],
    [/^163cn\.tv$/, 'ncm'],
    [/^(?:[a-z0-9-]+\.)?kugou\.com$/, 'kugou'],
    [/^(?:[a-z0-9-]+\.)?kuwo\.cn$/, 'kuwo'],
    [/^(?:[a-z0-9-]+\.)?bilibili\.com$/, 'bilibili'],
    [/^b23\.tv$/, 'bilibili'],
];
class ShareParser {
    shareUrl = '';
    host = '';
    platform: Platform | undefined;
    private getPlatform(): Platform | undefined {
        const host = this.host = getHost(this.shareUrl).toLowerCase();
        const platform = platformRegex.find(([regex]) => regex.test(host))?.[1] as Platform | undefined;
        if (platform) {
            this.platform = platform;
        }
        return platform;
    }
    public async parse(shareUrl: string) { try{
        this.shareUrl = shareUrl.trim();
        const platform = this.getPlatform();
        if (!platform) return null;

        return await platformShareIndex[platform]({shareUrl: this.shareUrl, host: this.host});
    } catch (_) {
        return null;
    }}
}
export default ShareParser;
