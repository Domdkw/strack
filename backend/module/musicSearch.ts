import { miguSearch } from "../plugin/migu/index";
import { ncmSearch } from "../plugin/ncm/index";


export const musicSearch = {
    migu: async (text: string, page: number, size: number) => {
        return await miguSearch(text, page, size);
    },
    ncm: async (text: string, page: number, size: number) => {
        return await ncmSearch(text, page, size);
    },
}
