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
    type Req = User & {
        offsetDay: number;
        songItem: OrderSong;
    }
}
export type ColumnEntry = Omit<SendOrder.Req, 'songItem' | 'offsetDay'> & {
    song: SongItem;
    followUsers: SendOrder.User[];
    timestamp: number
};
export type AdminReq = {
    name: string;
    userId: string;
    password: string;
    schoolName: string;
    sign: string;
    nonce: string;
}
export type deleteColumnRowReq = {
    offsetDay: number;
    deleteRows: {
        className: string;
        userName: string;
        userId: string;
        songItem: OrderSong;
    }[]
}