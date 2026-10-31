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
    author_name?: string;
    albumName?: string;
    album_name?: string;
    album_img?: string;
    imgUrl?: string;
    url?: string;
    // 试听失败的备用音源
    backup_url?: string[];
    // 秒；付费歌曲可能为 0，真实时长在 extra 中
    timeLength?: number | null;
    extra?: Record<string, number | string>;
    trans_param?: {
        union_cover?: string;
    };
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
        lrc: 'id:' + item.hash,
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

// getSongInfo.php 主域名偶尔请求失败或返回空数据，按顺序尝试备用域名
const KUGOU_INFO_HOSTS = [
    'https://m.kugou.com',
    'https://m3ws.kugou.com',
];

// id 为歌曲 hash
async function kugouSongInfo(id: string) {
    let lastRes: KugouSongInfo | undefined;
    let lastError: unknown;
    for (const host of KUGOU_INFO_HOSTS) {
        try {
            // 该接口返回 text/html，ofetch 不会自动解析 JSON，需强制指定
            const res = await ofetch<KugouSongInfo>(`${host}/app/i/getSongInfo.php`, {
                params: {cmd: 'playInfo', hash: id},
                parseResponse: JSON.parse,
                timeout: 10000,
            });
            lastRes = res;
            if (res.songName || res.fileName) return res;
        } catch (e) {
            lastError = e;
        }
    }
    if (lastRes) return lastRes;
    throw lastError ?? new Error('kugou song info failed');
}

export async function kugouPlayInfo(id: string) {
    const res = await kugouSongInfo(id);
    // timeLength 单位为秒；付费/免费歌曲可能为 0，此时用 extra 中的毫秒时长
    const duration = Number(res.timeLength)
        || Math.round((Number(res.extra?.['128timelength']) || 0) / 1000);
    const data: SongItem = {
        platform: 'kugou',
        id,
        title: res.songName || res.fileName || '',
        artist: res.author_name || res.singerName || '',
        album: res.albumName || res.album_name || '',
        duration,
        artwork: (res.album_img || res.trans_param?.union_cover || res.imgUrl)?.replace('{size}', '240'),
        url: res.url || res.backup_url?.[0] || '',
    };
    return data;
}
export async function kugouPlayUrl(id: string) {
    // id 为歌曲 hash，公开接口，免费歌曲返回试听 url，付费歌曲为空
    const res = await kugouSongInfo(id);
    return {url: res.url || res.backup_url?.[0] || ''};
}
