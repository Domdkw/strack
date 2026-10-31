import { ofetch } from "ofetch";
import { formatBiliMedia, formatBiliPublic } from "./format";

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63';

export interface BiliMediaItem {
    aid?: number | string;
    bvid?: string;
    cid?: number;
    title?: string;
    author?: string;
    owner?: {name?: string};
    pic?: string;
    duration?: string | number;
    album?: string;
}

let biliCookie: {b_3: string, b_4: string} | null = null;
async function getBiliCookie() {
    if (biliCookie) return biliCookie;
    const res = await ofetch<{data?: {b_3?: string, b_4?: string}}>(
        'https://api.bilibili.com/x/frontend/finger/spi',
        {headers: {'User-Agent': UA}},
    );
    biliCookie = {b_3: res.data?.b_3 ?? '', b_4: res.data?.b_4 ?? ''};
    return biliCookie;
}

async function doSearch(text: string, page: number, size: number) {
    const cookie = await getBiliCookie();
    return await ofetch<{data?: {numResults?: number, result?: BiliMediaItem[]}}>(
        'https://api.bilibili.com/x/web-interface/search/type',
        {
            headers: {
                'user-agent': UA,
                accept: 'application/json, text/plain, */*',
                origin: 'https://search.bilibili.com',
                referer: 'https://search.bilibili.com/',
                cookie: `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`,
            },
            params: {
                context: '',
                page,
                order: '',
                page_size: size,
                keyword: text,
                duration: '',
                tids_1: '',
                tids_2: '',
                __refresh__: true,
                _extra: '',
                highlight: 1,
                single_column: 0,
                platform: 'pc',
                from_source: '',
                search_type: 'video',
                dynamic_offset: 0,
            },
        }
    );
}

export async function bilibiliSearchV1(text: string, page: number, size: number) {
    const res = await doSearch(text, page, size);
    return {
        isEnd: (res.data?.numResults ?? 0) <= page * size,
        data: (res.data?.result ?? []).map(formatBiliPublic),
    }
}
export async function bilibiliSearchV2(text: string, page: number, size: number) {
    const res = await doSearch(text, page, size);
    return {
        isEnd: (res.data?.numResults ?? 0) <= page * size,
        data: (res.data?.result ?? []).map(formatBiliMedia),
    }
}

interface BiliView {
    code: number;
    data?: {
        aid: number;
        bvid: string;
        cid: number;
        title: string;
        pic: string;
        duration: number;
        owner: {name: string};
    };
}

// id 为 bvid（BV 开头）或 aid
export async function bilibiliPlayInfo(id: string) {
    const isBvid = /^BV/i.test(id);
    const res = await ofetch<BiliView>('https://api.bilibili.com/x/web-interface/view', {
        params: isBvid ? {bvid: id} : {aid: id},
        headers: {'user-agent': UA, referer: 'https://www.bilibili.com/'},
    });
    const d = res.data;
    if (!d) throw new Error('bilibili video not found');
    return formatBiliMedia({
        aid: d.aid,
        bvid: d.bvid,
        cid: d.cid,
        title: d.title,
        author: d.owner?.name,
        pic: d.pic,
        duration: d.duration,
    });
}
