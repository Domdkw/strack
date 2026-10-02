import { ofetch } from "ofetch";

interface NcmDetail {
    songs: { album: { picUrl: string } }[];
}

export async function ncmPlayInfo(id: string) {
    // 网易该接口返回 text/plain，ofetch 不会自动解析 JSON，需强制指定
    const res = await ofetch<NcmDetail>('https://music.163.com/api/song/detail', {
        params: { ids: '[' + id + ']' },
        parseResponse: JSON.parse,
    });
    return {
        artwork: res.songs[0].album.picUrl,
    };
}
