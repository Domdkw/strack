import type { Storage } from "unstorage";

const columnCache = new Map<string, {column: object, timestamp: number}>();

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
        if (now - cache.timestamp < 5 * 60 * 1000)
            return cache;
        ;// 缓存过期，从存储中获取栏目
    }
    const columnStr = await storage.getItem(columnId); // 从存储中获取栏目
    if (typeof columnStr === "string" && columnStr){
        const column = JSON.parse(columnStr) || {};
        if(!column){
            return {code: 205, error: 'column parse error'};
        }
        columnCache.set(columnId, {column, timestamp: Date.now()});
        return column;
    }else{
        return {code: 204, error: 'column not found'};
    }
    }catch(err){
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {code: 203, error: errorMessage};
    }
}

export {getOffsetColumn, getDateColumn};