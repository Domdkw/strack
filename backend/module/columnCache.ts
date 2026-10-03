import type { Storage } from "unstorage";
import type { SendOrder } from "../../shared/types/api/order";
import type { SongItem } from "../../shared/types/musicItem";
import { musicInfo } from "./musicInfo";

type ColumnEntry = SendOrder.Req & { timestamp: number };
const columnCache = new Map<string, { columns: ColumnEntry[], timestamp: number }>();

const CACHE_TTL = 5 * 60 * 1000; // 5小时缓存
const COLUMN_TTL = 31 * 24 * 60 * 60 * 1000; // 31天缓存

function getOffsetIndex(offsetDay: number){
    const date = new Date();
    date.setDate(date.getDate() - offsetDay);
    return date.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '-'); // 日期格式化为 yyyy-MM-dd shanghai 时间
}
async function getOffsetColumn(offsetDay: number, storage: Storage){
    const index = getOffsetIndex(offsetDay);
    return await getDateColumn(index, storage);
}

async function getDateColumn(columnId: string, storage: Storage){
    try{
    const cache = columnCache.get(columnId);
    if (cache){
        //5小时缓存
        const now = Date.now();
        if (now - cache.timestamp < CACHE_TTL)
            return cache;
        ;// 缓存过期，从存储中获取栏目
    }
    const strRes = await storage.getItem(columnId); // 从存储中获取栏目
    if (strRes){
        const remoteRes = typeof strRes === "string" 
            ? JSON.parse(strRes) || {} 
            : typeof strRes === "object"
                ? strRes : {}
        ;

        if(!remoteRes){
            return {code: 205, error: 'column parse error'};
        }
        // 合并缓存
        const currentRow = {
            columns: (remoteRes.columns || []) as ColumnEntry[], // 覆盖缓存
            timestamp: Date.now() // 更新缓存根时间
        }
        columnCache.set(columnId, currentRow);
        return {data: currentRow};
    }else{
        return {code: 204, error: 'column not found'};
    }
    }catch(err){
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {code: 203, error: errorMessage};
    }
}


const requiredKeys = ['platform', 'id', 'artist', 'album', 'title', 'duration'];//'artwork'
async function setColumn(body: SendOrder.Req, storage: Storage){
    const columnKeys = Object.keys(body);
    if(!requiredKeys.every(key => columnKeys.includes(key))){
        return {code: 208, msg: 'required keys not found'};
    }
    const index = getOffsetIndex(body.offsetDay);
    return await pushColumn(index, body, storage);
}

async function pushColumn(
    columnId: string,
    column: SendOrder.Req & { timestamp?: number },
    storage: Storage,
) {
    try {
        // 从平台获取 full song info
        if (!column.song.artwork) {
            column.song = {
                ...column.song,
                ...(await musicInfo[column.song.platform as keyof typeof musicInfo](String(column.song.id))),
            } as SongItem;
        }
        // 更新栏目时间
        const entry: ColumnEntry = { ...column, timestamp: Date.now() };

        let currentRow = columnCache.get(columnId);
        if (!currentRow) {
            // 新增栏目
            currentRow = { columns: [], timestamp: Date.now() };
        }
        currentRow.columns.push(entry);
        //更新根时间
        currentRow.timestamp = Date.now();
        // cache set
        columnCache.set(columnId, currentRow); // 覆盖缓存

        // write to storage
        await storage.setItem(columnId, currentRow, { ttl: COLUMN_TTL }); // 31天缓存
        // 返回push的栏目
        return { data: column };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { code: 209, error: errorMessage };
    }
}

export { getOffsetColumn, getDateColumn, setColumn };