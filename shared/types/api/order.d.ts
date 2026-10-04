import type { Platform } from "../base";
export type OrderSong = {
    id: string|number;
    isVip?: boolean;
    extInfo?: string;
    platform: Platform;
}

export namespace SendOrder {
    type User = {
        className: string;
        userName: string;
        userId: string;
    }
    type Req = Common & {
        offsetDay: number;
        songItem: OrderSong;
    }
}
export type ColumnEntry = Omit<SendOrder.Req, 'songItem'> & {
    song: SongItem;
    followUsers: SendOrder.User[];
    timestamp: number
};
