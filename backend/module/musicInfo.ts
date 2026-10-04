import { ncmPlayInfo } from "../plugin/ncm/playInfo";
import { miguPlayInfo } from "../plugin/migu/index";
export const musicInfo = {
    migu: async (id: string, _ext?: object) => {
        return await miguPlayInfo(id);
    },
    ncm: async (id: string, _ext?: object) => {
        return await ncmPlayInfo(id);
    },
}
