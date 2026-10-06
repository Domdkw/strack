import type { Storage } from "unstorage";
import type { SendOrder, ColumnEntry, OrderSong } from "../../shared/types/api/order";
import { platforms } from "../../shared/types/base";
import { musicInfo } from "./musicInfo";


type ColumnRow = { columns: ColumnEntry[]; timestamp: number };
type ColumnResult = { data: ColumnRow } | { code: number; error: string };

const columnCache = new Map<string, ColumnRow>();

const CACHE_TTL = 5 * 60 * 1000; // 栏目内存缓存时长（毫秒），默认 5 小时
const MAX_COLUMN = 22; // 最大栏目数，0-21天
const COLUMN_TTL = MAX_COLUMN * 24 * 60 * 60; // KV expirationTtl（秒），默认 22 天
const MAX_ORDER_ITEM = 10; // 最大订单项数

function getOffsetIndex(offsetDay: number){
    const date = new Date();
    date.setDate(date.getDate() + offsetDay);
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

async function getDateColumn(columnId: string, storage: Storage): Promise<ColumnResult>{
    try{
    const cache = columnCache.get(columnId);
    if (cache){
        //5小时缓存
        const now = Date.now();
        if (now - cache.timestamp < CACHE_TTL)
            return { data: cache };
        ;// 缓存过期，从存储中获取栏目
    }
    const strRes = await storage.getItem(columnId); // 从存储中获取栏目
    if (strRes){
        const remoteRes: Record<string, unknown> = typeof strRes === "string"
            ? JSON.parse(strRes) || {}
            : typeof strRes === "object"
                ? (strRes as Record<string, unknown>) : {}
        ;

        if(!remoteRes){
            return {code: 205, error: 'column parse error'};
        }
        // 合并缓存
        const currentRow: ColumnRow = {
            columns: (remoteRes.columns || []) as ColumnEntry[], // 覆盖缓存
            timestamp: Date.now() // 更新缓存根时间
        }
        columnCache.set(columnId, currentRow);
        return {data: currentRow};
    }else{
        // 无数据时返回空栏目（正常状态，不算错误）
        const emptyRow: ColumnRow = { columns: [] as ColumnEntry[], timestamp: Date.now() };
        columnCache.set(columnId, emptyRow);
        return {data: emptyRow};
    }
    }catch(err){
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {code: 203, error: errorMessage};
    }
}


const requiredKeys = {
    common: ['className', 'userName', 'userId', 'offsetDay', 'songItem'],
    songItem: ['id', 'platform'],
    song: ['platform', 'id', 'artist', 'album', 'title', 'duration']//'artwork'
};
async function setColumn(body: SendOrder.Req, storage: Storage){
    const columnKeys = Object.keys(body);
    const songItemKeys = Object.keys(body.songItem || {});
    if(!requiredKeys.common.every(key => columnKeys.includes(key) && (body as Record<string, unknown>)[key] !== undefined)){
        return {code: 208, error: 'common keys not found'};
    }
    if(!requiredKeys.songItem.every(key => songItemKeys.includes(key) && (body.songItem as Record<string, unknown>)[key] !== undefined)){
        return {code: 208, error: 'songItem keys not found'};
    }
    const curPlatform = body.songItem.platform;
    if(!curPlatform || !platforms.includes(curPlatform)){
        return {code: 210, error: 'songItem platform is invalid'};
    }
    const index = getOffsetIndex(body.offsetDay);
    return await pushColumn(index, body, storage);
}
async function pushColumn(
    columnId: string,
    column: Omit<SendOrder.Req, 'songItem'> & { songItem?: OrderSong; timestamp?: number },
    storage: Storage,
) {
    try {
        // 从平台获取 fullsong info（setColumn 已校验 songItem 必存在）
        const songItem = column.songItem!;
        const song = await musicInfo[songItem.platform](
            String(songItem.id)
        );
        //songItem 使用完后删除
        delete column.songItem;
        // 更新栏目时间
        const entry: ColumnEntry = {
            className: column.className,
            userName: column.userName,
            userId: column.userId,
            offsetDay: column.offsetDay,
            song: song,
            followUsers: [],
            timestamp: Date.now()
        };

        let currentRow = columnCache.get(columnId);
        if (!currentRow) {
            // 缓存未命中时从存储加载，避免覆盖已有栏目
            const res = await getDateColumn(columnId, storage);
            if (!('data' in res)) return res;
            currentRow = res.data;
        }
        if(currentRow.columns.length >= MAX_ORDER_ITEM){
            return {code: 211, error: 'max order item reached'};
        }
        // 重复歌曲（同平台同ID）：添加跟随用户而非新增条目
        const existing = currentRow.columns.find(
            (col) => col.song && col.song.platform === songItem.platform && String(col.song.id) === String(songItem.id)
        );
        if (existing) {
            // 同一用户不重复跟随
            const alreadyFollowed = existing.followUsers?.some((u) => u.userId === column.userId);
            if (!alreadyFollowed) {
                (existing.followUsers ??= []).push({
                    className: column.className,
                    userName: column.userName,
                    userId: column.userId,
                });
            }
            existing.timestamp = Date.now();
        } else {
            currentRow.columns.push(entry);
        }
        //更新根时间
        currentRow.timestamp = Date.now();
        // cache set
        columnCache.set(columnId, currentRow); // 覆盖缓存
        // write to storage
        await storage.setItem(columnId, currentRow, { ttl: COLUMN_TTL }); // 31天缓存
        // index set
        await updateIndexColumn(storage, columnId, currentRow);
        // 返回push的栏目
        return { data: column };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { code: 209, error: errorMessage };
    }
}


// 预览用：每天的歌曲摘要（含跟随人数）
type AllColumnDay = {
    songs: { artwork?: string; title: string; followCount: number }[];
    timestamp: number;
};
type ReturnAllColumn = Record<string, AllColumnDay> & {
    cacheHas?: boolean;
    writeToStorage?: boolean;
};
const INDEX_COLUMN_KEY = 'indexColumn';

const _getIndexColumnValue: (row: ColumnRow) => AllColumnDay = (row: ColumnRow) => ({
    songs: row.columns.map(col => ({
        artwork: col.song.artwork,
        title: col.song.title,
        followCount: col.followUsers?.length ?? 0,
    })),
    timestamp: row.timestamp,
})
async function buildIndexColumn(storage: Storage): Promise<ReturnAllColumn> {
    let columns: ReturnAllColumn = {};
    for(let i = 0; i < MAX_COLUMN; i++){
        const key = getOffsetIndex(i);
        const rowResult = await getDateColumn(key, storage) || null;
        if(!('data' in rowResult)){
            continue;
        }
        const row: ColumnRow = rowResult.data;
        columns[key] = _getIndexColumnValue(row);
        continue;
    }
    return columns;
}
async function updateIndexColumn(storage: Storage, columnId: string, columnRow: ColumnRow): Promise<void>{
    // unstorage getItem 会自动反序列化，可能是对象或字符串
    const kvRes = await storage.getItem(INDEX_COLUMN_KEY) || null;
    let res: ReturnAllColumn = kvRes
        ? (typeof kvRes === "string" ? JSON.parse(kvRes) : kvRes) as ReturnAllColumn
        : await buildIndexColumn(storage);
    res[columnId] = _getIndexColumnValue(columnRow);
    await storage.setItem(INDEX_COLUMN_KEY, res);
}
async function getAllColumn(storage: Storage): Promise<ReturnAllColumn> {
    let columns: ReturnAllColumn = {};
    let cacheHas = false;
    for(let i = 0; i < MAX_COLUMN; i++){
        const key = getOffsetIndex(i);
        const row = columnCache.get(String(key)) || null;
        if(!row){
            columns[key] = { songs: [], timestamp: Date.now() };
            continue;
        }
        cacheHas = true;
        columns[key] = _getIndexColumnValue(row);
    }
    columns.cacheHas = cacheHas;
    if(cacheHas){
        return columns;
    }
    // 冷启动：优先读 KV 索引（pushColumn 时由 updateIndexColumn 保持同步）
    const kvColumn = await storage.getItem(INDEX_COLUMN_KEY) as ReturnAllColumn || null;
    if(!kvColumn){
        // 索引未存在，从数据库逐日构建（getDateColumn 会同时填充内存缓存）
        columns = await buildIndexColumn(storage);
        // 写回 kv 持久化
        await storage.setItem(INDEX_COLUMN_KEY, columns);
        columns.writeToStorage = true;
        return columns;
    }
    // 索引存在（unstorage getItem 会自动反序列化，可能是对象或字符串）
    return (typeof kvColumn === "string" ? JSON.parse(kvColumn) : kvColumn) as ReturnAllColumn;
}
export { getOffsetColumn, getDateColumn, setColumn, getAllColumn };
