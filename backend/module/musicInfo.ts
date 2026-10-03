import { ncmPlayInfo } from "../plugin/ncm/playInfo";
export const musicInfo = {
    migu: async (_id: string, _ext?: object) => {
        return {};
    },
    ncm: async (id: string, _ext?: object) => {
        return await ncmPlayInfo(id);
    },
}
