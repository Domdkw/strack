import type { Storage } from "unstorage";
import type { ColumnEntry } from "../../../shared/types/api/order";
import {
    type ColumnObj,
    type ColumnResult,
    columnCache,
    getOffsetIndex,
    CACHE_TTL,
    jsonKv,
    getCreateTime,
} from "./common";


class ColumnGet {
    private storage: Storage;

    constructor(storage: Storage){
        this.storage = storage;
    }

    public async getOffsetColumn(offsetDay: number): Promise<ColumnResult>{
        const index = getOffsetIndex(offsetDay);
        return await this.getDateColumn(index, offsetDay);
    }

    public async getDateColumn(columnId: string, offsetDay: number): Promise<ColumnResult>{
        try{
        const cache: ColumnObj | undefined = columnCache.get(columnId);
        if (cache){
            //5小时缓存
            const now = Date.now();
            if (now - cache.cacheTime < CACHE_TTL)
                return { data: cache };
            ;// 缓存过期，从存储中获取栏目
        }
        const strRes = await this.storage.getItem(columnId); // 从存储中获取栏目
        if (strRes){
            const remoteRes: ColumnObj | undefined = jsonKv(strRes) || null;

            if(!remoteRes){
                return {code: 205, error: 'column parse error'};
            }
            // 合并缓存
            const currentRow: ColumnObj = {
                columns: (remoteRes.columns || []) as ColumnEntry[], // 覆盖缓存
                createTime: remoteRes.createTime || Date.now(), // 传递创建时间
                cacheTime: Date.now(), // 更新缓存根时间
                disabled: remoteRes.disabled === true, // 传递是否禁用，无键时默认false
            }
            columnCache.set(columnId, currentRow);
            return {data: currentRow};
        }else{
            // 无栏目时直接返回空数据，and set缓存
            const emptyRow: ColumnObj = {
                columns: [] as ColumnEntry[],
                createTime: getCreateTime(offsetDay),
                cacheTime: Date.now(),
                disabled: false, // 未禁用
            };
            columnCache.set(columnId, emptyRow);
            return {data: emptyRow};
        }
        }catch(err){
            const errorMessage = err instanceof Error ? err.message : String(err);
            return {code: 203, error: errorMessage};
        }
    }
}


export default ColumnGet;
export { ColumnGet };
