import { ncmPlayInfo } from "../plugin/ncm/playInfo";
import { miguPlayInfo } from "../plugin/migu/index";
import { kugouPlayInfo } from "../plugin/kugou/index";
import { kuwoPlayInfo } from "../plugin/kuwo/index";
import { bilibiliPlayInfo } from "../plugin/bilibili/index";
export const musicInfo = {
    migu: async (id: string, _ext?: object) => {
        return await miguPlayInfo(id);
    },
    ncm: async (id: string, _ext?: object) => {
        return await ncmPlayInfo(id);
    },
    kugou: async (id: string, _ext?: object) => {
        return await kugouPlayInfo(id);
    },
    kuwo: async (id: string, _ext?: object) => {
        return await kuwoPlayInfo(id);
    },
    bilibili: async (id: string, _ext?: object) => {
        return await bilibiliPlayInfo(id);
    },
}
