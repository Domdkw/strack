export const musicUrl = {
    migu: async (id: string, ext?: Record<string, any>, _isVip?: boolean) => {
        return {url: `https://migum.jsdm.qzz.io/migu/url?contentId=${id}&copyrightId=${ext?.copyrightId}&songId=${ext?.songId}&302`};
    },
    ncm: async (id: string, _ext?: Record<string, any>, _isVip?: boolean) => {
        return {url: `https://music.163.com/song/media/outer/url?id=${id}`};
    },
}
