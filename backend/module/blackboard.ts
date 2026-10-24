import type { Storage } from "unstorage";
import type { Blackboard } from "../../shared/types/api/order";
import { jsonKv } from "./columns/common";
import xss from "xss";

const BLACKBOARD_KEY = 'blackboard';
const blackboardCache: Blackboard = {
    text: '',
    textType: 'plain',
};
let isUpdate = true; // 初始化时需要更新

export async function blackboardGet(storage: Storage): Promise<Blackboard> {
    let blackboard: Blackboard = blackboardCache;
    let kvRes = null;
    if(isUpdate){
        kvRes = await storage.getItem(BLACKBOARD_KEY) || null;
        blackboard = kvRes
            ? jsonKv(kvRes) // json化 kv
            : blackboardCache;
    }
    /** 1. 被更新，数据库有数据 => kvRes T, isUpdate T => N
     * 2. 未更新 isUpdate F => isUpdate F, kvRes N => N
     * 3. 未更新(init=T)，数据库有数据 => isUpdate T, kvRes T => N (cf1 强制无缓存)
     * 4. 未更新(init=T)，数据库无数据 => isUpdate T, kvRes F => T (cf2)
     *   巧妙吧（￣︶￣）↗ 2026年10月24日
    */
    if (!kvRes && isUpdate) { //初始化 blackboard
        await storage.setItem(BLACKBOARD_KEY, blackboard);
        isUpdate = false; // 下次不读取数据库
    }
    //if(!blackboard.text){
    //    return null // 206 Not Content
    //}
    Object.assign(blackboardCache, blackboard); // 刷新缓存
    return blackboard;
}
export async function blackboardSet(storage: Storage, blackboard: Partial<Blackboard>) {
    const { text, textType = 'plain' } = blackboard;
    if (
        typeof text !== "string" ||
        text.length > 200 ||
        textType !== 'plain'
        //!["plain", "markdown", "html", "iframe"].includes(textType)
    ) {
        return { code: 213, error: "text is required or too long" }; // 400 Bad Request
    }
    const next: Blackboard = {
        text: xss(text),
        textType,
    };
    await storage.setItem(BLACKBOARD_KEY, next);
    Object.assign(blackboardCache, next); // 同实例内立即生效
    isUpdate = true; // 下次需要读取数据库
    return { data: { ok: true } };
}
