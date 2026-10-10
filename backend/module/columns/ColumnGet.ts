import type { Storage } from "unstorage";
import type { ColumnEntry } from "../../../shared/types/api/order";
import {
    type ColumnRow,
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
        const cache: ColumnRow | undefined = columnCache.get(columnId);
        if (cache){
            //5小时缓存
            const now = Date.now();
            if (now - cache.cacheTime < CACHE_TTL)
                return { data: cache };
            ;// 缓存过期，从存储中获取栏目
        }
        const strRes = await this.storage.getItem(columnId); // 从存储中获取栏目
        if (strRes){
            const remoteRes: ColumnRow | undefined = jsonKv(strRes) || null;

            if(!remoteRes){
                return {code: 205, error: 'column parse error'};
            }
            // 合并缓存
            const currentRow: ColumnRow = {
                columns: (remoteRes.columns || []) as ColumnEntry[], // 覆盖缓存
                createTime: remoteRes.createTime || Date.now(), // 传递创建时间
                cacheTime: Date.now() // 更新缓存根时间
            }
            columnCache.set(columnId, currentRow);
            return {data: currentRow};
        }else{
            // 无栏目时直接返回空数据，and set缓存
            const emptyRow: ColumnRow = {
                columns: [] as ColumnEntry[],
                createTime: getCreateTime(offsetDay),
                cacheTime: Date.now(),
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
