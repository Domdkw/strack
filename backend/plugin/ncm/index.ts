import { ofetch } from "ofetch";
import type { SongItem } from "../../../shared/types/musicItem";


interface NcmArtist {
    name: string;
}
interface NcmSong {
    id: number;
    name: string;
    artists: NcmArtist[];
    album: { name: string };
    duration: number;
}

function formatNcmSong(song: NcmSong): SongItem {
    return {
        platform: 'ncm',
        id: String(song.id),
        title: song.name,
        artist: song.artists.map((item) => item.name).join('/'),
        album: song.album.name,
        duration: Number(song.duration)/1000,
        lrc: 'id:' + song.id,
    }
}
export async function ncmSearch(text: string, page: number, size: number) {
    // 网易该接口返回 text/plain，ofetch 不会自动解析 JSON，需强制指定
    const res = await ofetch<{ result: { hasMore: boolean; songCount: number; songs: NcmSong[] } }>(
        'https://music.163.com/api/search/get',
        {
            params: {
                s: text,
                type: 1,
                limit: size,
                offset: (page - 1) * size,
            },
            parseResponse: JSON.parse,
        }
    );
    return {
        isEnd: !res.result.hasMore,
        data: res.result.songs.map((item) => formatNcmSong(item)),
    }
}
