import type { Storage } from "unstorage";
import {
    type ColumnRow,
    getOffsetIndex,
    MAX_COLUMN,
    INDEX_COLUMN_KEY,
    COLUMN_TTL_MS,
    jsonKv,
} from "./common";

import ColumnGet from "./ColumnGet";


// 预览用：每天的歌曲摘要（含跟随人数）
type AllColumnDay = {
    songs: { artwork?: string; title: string; followCount: number }[];
    timestamp: number;
};
type ReturnAllColumn = Record<string, AllColumnDay> & {
    cacheHas?: boolean;
    writeToStorage?: boolean;
};
let indexColumnCache: ReturnAllColumn = {};

class ColumnIndex {
    private storage: Storage;
    constructor(storage: Storage){
        this.storage = storage;
    }
    private _getIndexColumnValue: (row: ColumnRow) => AllColumnDay = (row: ColumnRow) => ({
        songs: row.columns.map(col => ({
            artwork: col.song.artwork,
            title: col.song.title,
            followCount: col.followUsers?.length ?? 0,
        })),
        timestamp: row.createTime,
    })
    private async buildIndexColumn(): Promise<ReturnAllColumn> {
        let columns: ReturnAllColumn = {};
        for(let i = 0; i < MAX_COLUMN; i++){
            const key = getOffsetIndex(i);
            const rowResult = await new ColumnGet(this.storage).getDateColumn(key, i) || null;
            if(!('data' in rowResult)){
                continue;
            }
            const row: ColumnRow = rowResult.data;
            columns[key] = this._getIndexColumnValue(row);
            continue;
        }
        return columns;
    }
    private delTimeoutColumn(allColumn: ReturnAllColumn): ReturnAllColumn{
        // 返回新对象而非原地删除，便于调用方通过引用比较判断是否有变化
        const result: ReturnAllColumn = {};
        const keys = Object.keys(allColumn);
        for(let key of keys){
            const column = allColumn[key];
            if(column.timestamp && Date.now() < column.timestamp){ // 锚点（栏目日期次日 0 点）未过，未过期
                result[key] = column;
            }
        }
        return result;
    }
    public async updateIndexColumn(columnId: string, columnRow: ColumnRow): Promise<void>{
        // unstorage getItem 会自动反序列化，可能是对象或字符串
        const kvRes = await this.storage.getItem(INDEX_COLUMN_KEY) || null;
        let res: ReturnAllColumn = kvRes
            ? jsonKv(kvRes) as ReturnAllColumn
            : await this.buildIndexColumn();
        res[columnId] = this._getIndexColumnValue(columnRow);
        // 过期删除
        res = this.delTimeoutColumn(res);
        // 缓存更新
        indexColumnCache = res;
        // 写回 kv 持久化
        await this.storage.setItem(INDEX_COLUMN_KEY, res);
    }
    public async getAllColumn(): Promise<ReturnAllColumn> {
        let columns: ReturnAllColumn = indexColumnCache;
        if(Object.keys(columns).length > 0){
            columns.cacheHas = true;
            return columns;
        }
        // 冷启动：优先读 KV 索引（pushColumn 时由 updateIndexColumn 保持同步）
        const kvColumn = await this.storage.getItem(INDEX_COLUMN_KEY) as ReturnAllColumn || null;
        if(!kvColumn){
            // 索引未存在，从数据库逐日构建（getDateColumn 会同时填充内存缓存）
            columns = await this.buildIndexColumn();
            // 写回 kv 持久化
            await this.storage.setItem(INDEX_COLUMN_KEY, columns);
            columns.writeToStorage = true; // 标记为已写入存储
            return columns;
        }
        // 索引存在（unstorage getItem 会自动反序列化，可能是对象或字符串）
        columns = (typeof kvColumn === "string" ? JSON.parse(kvColumn) : kvColumn) as ReturnAllColumn;
        // 过期检测
        const deletedColumns = this.delTimeoutColumn(columns);
        if(columns !== deletedColumns){
            await this.storage.setItem(INDEX_COLUMN_KEY, deletedColumns);
            columns = deletedColumns;
        }
        // 缓存更新
        indexColumnCache = columns;
        //构建返回值
        columns.cacheHas = false; columns.writeToStorage = false;
        return columns;
    }
}
export default ColumnIndex;
export { ColumnIndex };