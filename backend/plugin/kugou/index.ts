import { ofetch } from "ofetch";
import type { SongItem } from "../../../shared/types/musicItem";

interface KugouSearchItem {
    FileHash: string;
    SongName: string;
    SingerName: string;
    AlbumName: string;
    Duration: number;
    Image?: string;
}

interface KugouSongInfo {
    songName?: string;
    fileName?: string;
    singerName?: string;
    authors?: {author_name?: string}[];
    albumName?: string;
    img?: string;
    url?: string;
    timeLen?: number | null;
}

function formatKugouSong(item: KugouSearchItem): SongItem {
    return {
        platform: 'kugou',
        id: item.FileHash,
        title: item.SongName.replace(/<\/?em>/g, ''),
        artist: item.SingerName,
        album: item.AlbumName,
        duration: Number(item.Duration) || 0,
        artwork: item.Image?.replace('{size}', '240'),
        // 音源接口依赖 hash
        lrc: 'hash:' + item.FileHash,
    }
}

export async function kugouSearch(text: string, page: number, size: number) {
    const res = await ofetch<{data: {lists: KugouSearchItem[]}}>(
        'https://songsearch.kugou.com/song_search_v2',
        {
            params: {
                keyword: text,
                page,
                pagesize: size,
            },
            // 接口返回 text/html，ofetch 不会自动解析 JSON，需强制指定
            parseResponse: JSON.parse,
        }
    );
    const lists = res.data?.lists ?? [];
    return {
        isEnd: lists.length < size,
        data: lists.map(formatKugouSong),
    }
}

// id 为歌曲 hash
export async function kugouPlayInfo(id: string) {
    // 该接口返回 text/html，ofetch 不会自动解析 JSON，需强制指定
    const res = await ofetch<KugouSongInfo>('https://m.kugou.com/app/i/getSongInfo.php', {
        params: {cmd: 'playInfo', hash: id},
        parseResponse: JSON.parse,
    });
    const data: SongItem = {
        platform: 'kugou',
        id,
        title: res.songName || res.fileName || '',
        artist: res.singerName || res.authors?.[0]?.author_name || '',
        album: res.albumName || '',
        duration: Number(res.timeLen) || 0,
        artwork: res.img?.replace('{size}', '240'),
        url: res.url,
    };
    return data;
}
export async function kugouPlayUrl(id: string) {
    // id 为歌曲 hash，公开接口，免费歌曲返回试听 url（返回 text/html，需手动解析 JSON）
    const res = await ofetch<{url?: string}>('https://m.kugou.com/app/i/getSongInfo.php', {
        params: {cmd: 'playInfo', hash: id},
        parseResponse: JSON.parse,
    });
    return {url: res.url};
}
