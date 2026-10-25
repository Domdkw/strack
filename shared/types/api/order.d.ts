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
    type OrderItem = {
        offsetDay: number;
        songItem: OrderSong;
        text?: string;
    }
    export type Req = User & OrderItem;
}
export type ColumnEntry = Omit<SendOrder.Req, 'songItem' | 'offsetDay'> & {
    song: SongItem;
    followUsers: SendOrder.User[];
    timestamp: number
    text?: string;
};
export type AdminReq = {
    name: string;
    userId: string;
    password: string;
    schoolName: string;
    sign: string;
    nonce: string;
    timestamp: number;
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
export type Blackboard = {
    text: string;
    textType: 'plain' | 'markdown' | 'html' | 'iframe';
}