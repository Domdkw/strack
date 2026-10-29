import type { Storage } from "unstorage";
import type { ColumnEntry, OrderExchange, ColumnIdentify } from "../../../shared/types/api/order";
import {
    type ColumnObj, type ColumnResult,
    getOffsetIndex,
} from "./common";
import ColumnGet from "./ColumnGet";
import ColumnSet from "./ColumnSet";
import { verifySetOffset } from "../../utils/verifyOffset";

function _groupItems(columnRows: ColumnEntry[], identifyList: ColumnIdentify[]): {identifiedColumns: ColumnEntry[], returnColumns: ColumnEntry[]} {
    const identifiedColumns: ColumnEntry[] = [];
    const returnColumns: ColumnEntry[] = [];
    for(let i=0; i < columnRows.length; i++){
        const cur = columnRows[i];
        if(identifyList.some(
            (item) => `${item.songItem.id}|${item.userId}|${item.userName}|${item.className}` === `${cur.song.id}|${cur.userId}|${cur.userName}|${cur.className}`,
        )){
            // 分类列
            identifiedColumns.push(cur);
        }else{
            // 保留列
            returnColumns.push(cur);
        }
    }
    return {identifiedColumns, returnColumns};
}
class ColumnEx {
    private storage: Storage;
    constructor(storage: Storage){
        this.storage = storage;
    }
    // 这可能不是最优解 O(n^3)
    // 传入识别体
    public async exchange(body: Partial<OrderExchange>): Promise<{code?: number, data: object} | {code: number, error: string}>{
        if(!Array.isArray(body) || body.length === 0) return {code: 314, error: 'body length error'}

        const columnGet = new ColumnGet(this.storage);
        const columnSet = new ColumnSet(this.storage);

        // 按日期索引缓存列数据，同一请求内多次交换先作用于缓存
        const columnsCache: Record<string, ColumnObj> = {};
        const loadColumn = async (offsetDay: number): Promise<ColumnObj | {code: number, error: string}> => {
            const columnId = getOffsetIndex(offsetDay);
            const cached = columnsCache[columnId];
            if (cached) return cached;

            const res: ColumnResult = await columnGet.getDateColumn(columnId, offsetDay);
            if (!('data' in res)) return res;
            // 拷贝一份，避免直接修改 ColumnGet 的全局缓存
            const copy: ColumnObj = {...res.data, columns: res.data.columns.slice()};
            columnsCache[columnId] = copy;
            return copy;
        };

        let exchanged = 0;
        try{
            /// 交换列
            for(const cur of body){
                if(!cur || !cur.from || !verifySetOffset(cur.from.offsetDay) || !verifySetOffset(cur.targetOffsetDay)){
                    return {code: 315, error: 'offset error'}
                }
                if(!cur.from.origin) return {code: 316, error: 'origin error'}

                const fromColumn = await loadColumn(cur.from.offsetDay);
                if (!('columns' in fromColumn)) return fromColumn;

                const toColumn = await loadColumn(cur.targetOffsetDay);
                if (!('columns' in toColumn)) return toColumn;

                const {identifiedColumns, returnColumns} = _groupItems(fromColumn.columns, [cur.from.origin]);
                if(identifiedColumns.length === 0) continue;

                // 源列移除已识别条目
                fromColumn.columns = returnColumns;
                // 目标列拼接识别列
                toColumn.columns = toColumn.columns.concat(identifiedColumns);
                exchanged += identifiedColumns.length;
            }
            // 设置列数据
            for(const columnId of Object.keys(columnsCache)){
                await columnSet.setColumnObj(columnId, columnsCache[columnId]);
            }
        }catch(error){
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {code: 317, error: errorMessage};
        }
        return {data: {exchanged}};
    }
}
export default ColumnEx;