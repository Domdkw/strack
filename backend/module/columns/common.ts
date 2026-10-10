import type { ColumnEntry } from "../../../shared/types/api/order";

export type ColumnRow = { columns: ColumnEntry[]; createTime: number, cacheTime: number };
export type ColumnResult =
    | { data: ColumnRow }
    | { code: number; error: string};
;

export const columnCache = new Map<string, ColumnRow>();

export const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 小时
export const MAX_COLUMN = 22; // 最大栏目数，0-21天
export const COLUMN_TTL = MAX_COLUMN * 24 * 60 * 60; // KV expirationTtl（秒），默认 22 天
export const MAX_ORDER_ITEM = 10; // 最大订单项数
export const INDEX_COLUMN_KEY = 'indexColumn';

export function getOffsetIndex(offsetDay: number){
    const date = new Date();
    date.setDate(date.getDate() + offsetDay);
    return date.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '-'); // 日期格式化为 yyyy-MM-dd shanghai 时间
}
export function jsonKv(kvRes: string | number | true | object){
    return typeof kvRes === "string" ? JSON.parse(kvRes) : kvRes;
}
export function getCreateTime(offsetDay: number){
    // 过期锚点：目标日期（上海时区 UTC+8，无夏令时）次日 0 点，即当天结束后过期
    const DAY_MS = 24 * 60 * 60 * 1000;
    const shNow = Date.now() + 8 * 60 * 60 * 1000; // 换算到上海时区的毫秒刻度
    const shDayStart = Math.floor(shNow / DAY_MS) * DAY_MS; // 上海时区今天 0 点（+8 刻度）
    return shDayStart + (offsetDay + 1) * DAY_MS - 8 * 60 * 60 * 1000; // 目标日期次日 0 点对应的 UTC 时间戳
}
