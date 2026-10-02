import { ofetch } from "ofetch";
import { formatMusicItem } from './format';
export async function miguSearch(text: string, page: number, size: number) {
    const res: object[] = await ofetch('https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0', {
        query: {
            text,
            pageNo: page,
            pageSize: size,
        },
    });
    const isEnd = res.length < size;
    return {
        data: res.map((item) => formatMusicItem(item)),
        isEnd,
    };
}
