import { ofetch } from "ofetch";
import { formatMusicItem } from './format';
export async function miguSearch(text: string, page: number, size: number) {
    const res: any = await ofetch('https://app.c.nf.migu.cn/bmw/search/song/v1.0', {
        query: {
            text,
            pageNo: page,
            pageSize: size,
        },
    });
    const isEnd = !res.data.hasNext;
    return {
        data: res.data.items.map((item: any) => formatMusicItem(item)),
        isEnd,
    };
}
