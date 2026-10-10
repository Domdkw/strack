import type { Storage } from "unstorage";
import type { SendOrder, ColumnEntry, OrderSong } from "../../../shared/types/api/order";
import { platforms } from "../../../shared/types/base";
import { musicInfo } from "../musicInfo";
import {
    columnCache,
    getOffsetIndex,
    MAX_ORDER_ITEM,
    COLUMN_TTL
} from "./common";

import ColumnGet from "./ColumnGet";
import ColumnIndex from "./ColumnIndex";

class ColumnSet {
    private storage: Storage;
    private requiredKeys = {
        common: ['className', 'userName', 'userId', 'offsetDay', 'songItem'],
        songItem: ['id', 'platform'],
        song: ['platform', 'id', 'artist', 'album', 'title', 'duration']//'artwork'
    };
    constructor(storage: Storage){
        this.storage = storage;
    }
    public async setColumn(body: SendOrder.Req){
        const columnKeys = Object.keys(body);
        const songItemKeys = Object.keys(body.songItem || {});
        if(!this.requiredKeys.common.every(key => columnKeys.includes(key) && (body as Record<string, unknown>)[key] !== undefined)){
            return {code: 208, error: 'common keys not found'};
        }
        if(!this.requiredKeys.songItem.every(key => songItemKeys.includes(key) && (body.songItem as Record<string, unknown>)[key] !== undefined)){
            return {code: 208, error: 'songItem keys not found'};
        }
        const curPlatform = body.songItem.platform;
        if(!curPlatform || !platforms.includes(curPlatform)){
            return {code: 210, error: 'songItem platform is invalid'};
        }
        const index = getOffsetIndex(body.offsetDay);
        return await this.pushColumn(index, body);
    }
    public async pushColumn(
        columnId: string,
        column: Omit<SendOrder.Req, 'songItem'> & { songItem?: OrderSong; timestamp?: number },
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

            // 加载栏目
            const res = await new ColumnGet(this.storage).getDateColumn(columnId, column.offsetDay);
            if (!('data' in res)) return res;
            const currentRow = res.data;

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
            currentRow.cacheTime = Date.now();
            // currentRow.createTime 不操作
            // cache set
            columnCache.set(columnId, currentRow); // 覆盖缓存
            // write to storage
            await this.storage.setItem(columnId, currentRow, { ttl: COLUMN_TTL }); // 21天缓存
            // index set
            await new ColumnIndex(this.storage).updateIndexColumn(columnId, currentRow);
            // 返回push的栏目
            return { data: column };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return { code: 209, error: errorMessage };
        }
    }
}

export default ColumnSet;
