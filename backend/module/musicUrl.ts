import { ncmPlayInfo } from "../plugin/ncm/playInfo";
export const musicUrl = {
    migu: async (id: string, ext?: object, isVip?: boolean) => {
        return {url: `https://migum.jsdm.qzz.io/migu/url?contentId=${id}&302`};
    },
    ncm: async (id: string, ext?: object, isVip?: boolean) => {
        return {
            url: `https://music.163.com/song/media/outer/url?id=${id}`,
            ...(await ncmPlayInfo(id)),
        };
    },
}
