import { ofetch } from "ofetch";
import { MD5, SHA1, enc } from "crypto-js";
import type { SongItem } from "../../../shared/types/musicItem";

// ===== 酷我 web API 鉴权（Secret/Token），参考开源实现 =====
const KW_UA = 'Mozilla/5.0 Chrome/143.0.7499.192 Mobile Safari/537.36 QQ/';

let kwAuth: {cookie: string, secret: string, token: string} | null = null;

function computeSecret(name: string, value: string): string {
    // n 为 cookie 名逐字符 charCode 拼接
    const digits = name.split('').map((c) => c.charCodeAt(0)).join('');
    const at = (i: number) => i < digits.length ? digits.charAt(i) : '';
    const r = Math.floor(digits.length / 5);
    const o = parseInt(at(r) + at(2 * r) + at(3 * r) + at(4 * r) + at(5 * r)) || 0;
    const l = Math.ceil(name.length / 2);
    const c = Math.pow(2, 31) - 1;
    const d = Math.round(1e9 * Math.random()) % 1e8;
    let n = digits + d.toString();
    while (n.length > 10) {
        n = (parseInt(n.substring(0, 10)) + parseInt(n.substring(10))).toString();
    }
    let num = (o * Number(n) + l) % c;
    let f = '';
    for (let i = 0; i < value.length; i++) {
        const h = value.charCodeAt(i) ^ Math.floor(num / c * 255);
        f += ('00' + h.toString(16)).slice(-2);
        num = (o * num + l) % c;
    }
    return f + ('00000000' + d.toString(16)).slice(-8);
}

async function getKwAuth() {
    if (kwAuth) return kwAuth;
    // favicon 响应会 Set-Cookie: Hm_Iuvt_xxx=yyy
    const res = await ofetch.raw('https://www.kuwo.cn/favicon.ico?v=1', {
        headers: {'User-Agent': KW_UA},
    });
    const setCookie = res.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0];
    const [name, value] = cookie.split('=');
    kwAuth = {
        cookie: `${cookie}; BAIDU_RANDOM=${value}`,
        secret: computeSecret(name, value),
        // Token = md5(sha1(value)) 大写
        token: MD5(SHA1(value).toString(enc.Hex)).toString().toUpperCase(),
    };
    return kwAuth;
}

async function kwWebApi<T>(path: string): Promise<T> {
    const auth = await getKwAuth();
    const sep = path.includes('?') ? '&' : '?';
    return await ofetch<T>(`https://www.kuwo.cn/api/www/${path}${sep}httpsStatus=1&reqId=${crypto.randomUUID()}&plat=web_www&from=`, {
        headers: {
            'Referer': 'https://kuwo.cn/',
            'Cookie': auth.cookie,
            'Secret': auth.secret,
            'Token': auth.token,
            'User-Agent': KW_UA,
        },
    });
}

// ===== 搜索（公开接口，返回严格 JSON）=====
interface KwSearchItem {
    MUSICRID?: string;
    songName?: string;
    SONGNAME?: string;
    NAME?: string;
    ARTIST?: string;
    ALBUM?: string;
    DURATION?: string | number;
    web_albumpic_short?: string;
}

function formatKwSong(item: KwSearchItem): SongItem {
    return {
        platform: 'kuwo',
        id: item.MUSICRID?.split('_')[1]?.split('&')[0] ?? '',
        title: (item.songName || item.SONGNAME || item.NAME || '').replace(/&nbsp;/g, ' '),
        artist: item.ARTIST || '',
        album: (item.ALBUM || '').replace(/&nbsp;/g, ' '),
        duration: Number(item.DURATION) || 0,
        artwork: item.web_albumpic_short
            ? `https://img2.kuwo.cn/star/albumcover/${item.web_albumpic_short.replace(/^120/, '500')}`
            : undefined,
    }
}

export async function kuwoSearch(text: string, page: number, size: number) {
    const res = await ofetch<{abslist?: KwSearchItem[], TOTAL?: string | number}>('http://search.kuwo.cn/r.s', {
        params: {
            rformat: 'json',
            encoding: 'utf8',
            ft: 'music',
            rn: size,
            pn: page - 1,
            all: text,
            vipver: 'MUSIC_8.0.3.0_BCS75',
            mobi: 1,
            newsearch: 1,
            searchapi: 7,
            issubtitle: 1,
            vermerge: 1,
            strategy: 2012,
            show_copyright_off: 1,
            correct: 1,
            cluster: 0,
            client: 'kt',
            spPrivilege: 0,
            newver: 3,
        },
        // 接口返回 text/html，ofetch 不会自动解析 JSON，需强制指定
        parseResponse: JSON.parse,
    });
    const list = res.abslist ?? [];
    const total = Number(res.TOTAL) || 0;
    return {
        isEnd: list.length < size || (page * size) >= total,
        data: list.map(formatKwSong),
    }
}

// ===== 歌曲详情 =====
interface KwMusicInfo {
    name?: string;
    artist?: string;
    album?: string;
    duration?: number;
    pic?: string;
    rid?: string | number;
}

export async function kuwoPlayInfo(id: string) {
    const res = await kwWebApi<{data?: KwMusicInfo}>(`music/musicInfo?mid=${id}`);
    const d = res.data ?? {};
    return {
        platform: 'kuwo',
        id: String(d.rid ?? id),
        title: d.name || '',
        artist: d.artist || '',
        album: d.album || '',
        duration: Number(d.duration) || 0,
        artwork: d.pic,
    } as SongItem;
}

export async function kuwoPlayUrl(id: string) {
    // 优先走 web playUrl：能直接判断歌曲是否可播放
    const auth = await getKwAuth();
    const web = await ofetch<{success?: boolean, data?: {url?: string}}>(
        `https://kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=music&httpsStatus=1&reqId=${crypto.randomUUID()}&plat=web_www`,
        {
            headers: {
                'Referer': 'https://kuwo.cn/',
                'Cookie': auth.cookie,
                'Secret': auth.secret,
                'Token': auth.token,
                'User-Agent': KW_UA,
            },
        }
    ).catch(() => undefined);
    return {url: web?.data?.url?.trim() || ''};
}
