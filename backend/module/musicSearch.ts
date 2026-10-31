import { miguSearch } from "../plugin/migu/index";
import { ncmSearch } from "../plugin/ncm/index";
import { kugouSearch } from "../plugin/kugou/index";
import { kuwoSearch } from "../plugin/kuwo/index";
import { bilibiliSearchV1, bilibiliSearchV2 } from "../plugin/bilibili/index";


export const musicSearch = {
    migu: miguSearch,
    ncm: ncmSearch,
    kugou: kugouSearch,
    kuwo: kuwoSearch,
    bilibili: bilibiliSearchV1,
}
export const musicSearchV2 = {
    migu: miguSearch,
    ncm: ncmSearch,
    kugou: kugouSearch,
    kuwo: kuwoSearch,
    bilibili: bilibiliSearchV2,
}