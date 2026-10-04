import { ofetch } from "ofetch";
import type { SongItem } from "../../../shared/types/musicItem";

interface NcmDetail {
    songs: {
        id: string;
        album: { name: string; picUrl: string };
        artists: { name: string }[];
        name: string;
        duration: number;
    }[];
}

export async function ncmPlayInfo(id: string) {
    // 网易该接口返回 text/plain，ofetch 不会自动解析 JSON，需强制指定
    const res = await ofetch<NcmDetail>('https://music.163.com/api/song/detail', {
        params: { ids: '[' + id + ']' },
        parseResponse: JSON.parse,
    });
    const data: SongItem = {
        platform: 'ncm', // 平台
        id: res.songs[0].id, // 唯一id
        artist: res.songs[0].artists.map((item) => item.name).join('/'), // 作者
        album: res.songs[0].album.name,
        title: res.songs[0].name,
        duration: Number(res.songs[0].duration)/1000,
        artwork: res.songs[0].album.picUrl+'??param=100y100',
        //new
        artists: res.songs[0].artists,
    };
    return data;
}
