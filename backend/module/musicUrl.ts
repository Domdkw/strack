import { kuwoPlayUrl } from "../plugin/kuwo/index";
import { getPlayUrl as bilibiliPlayUrl } from "../plugin/bilibili/playUrl";
import { kugouPlayUrl } from "../plugin/kugou/index";

export const musicUrl = {
    migu: async (id: string, ext?: Record<string, any>, _isVip?: boolean) => {
        return {url: `https://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=PQ&copyrightId=${ext?.copyrightId || '0'}&contentId=${id}&resourceType=2&channel=0146921`};
    },
    ncm: async (id: string, _ext?: Record<string, any>, _isVip?: boolean) => {
        return {url: `https://music.163.com/song/media/outer/url?id=${id}`};
    },
    kugou: async (id: string, _ext?: Record<string, any>, _isVip?: boolean) => kugouPlayUrl(id),
    kuwo: async (id: string, _ext?: Record<string, any>, _isVip?: boolean) => kuwoPlayUrl(id),
    bilibili: async (id: string, ext?: Record<string, any>, _isVip?: boolean) => bilibiliPlayUrl(id, ext),
}
