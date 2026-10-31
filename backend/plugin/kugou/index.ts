import { ofetch } from "ofetch";
import type { SongItem } from "../../../shared/types/musicItem";

interface KugouSearchItem {
    hash: string;
    songname: string;
    singername: string;
    album_name: string;
    duration: number | string;
    trans_param?: {
        union_cover?: string;
    };
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
        id: item.hash,
        title: item.songname.replace(/<\/?em>/g, ''),
        artist: item.singername,
        album: item.album_name,
        duration: Number(item.duration) || 0,
        artwork: item.trans_param?.union_cover?.replace('{size}', '240'),
        // 音源接口依赖 hash
        lrc: 'hash:' + item.hash,
    }
}

export async function kugouSearch(text: string, page: number, size: number) {
    const res = await ofetch<{data: {info?: KugouSearchItem[], total?: number | string}}>(
        'http://msearchcdn.kugou.com/api/v3/search/song',
        {
            params: {
                showtype: 14,
                pagesize: size,
                keyword: text,
                page,
                tag_aggr: 1,
                tagtype: '全部',
                plat: 0,
                sver: 5,
                correct: 1,
                api_ver: 1,
                version: 9108,
                area_code: 1,
                tag: 1,
                // 关闭 HTML 标签包裹，直接返回 JSON
                with_res_tag: 0,
            },
            // 接口返回 text/html，ofetch 不会自动解析 JSON，需强制指定
            parseResponse: JSON.parse,
        }
    );
    const lists = res.data?.info ?? [];
    const total = Number(res.data?.total) || 0;
    return {
        isEnd: lists.length < size || page * size >= total,
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
