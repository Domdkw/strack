import { SongItem } from "../musicItem";
export namespace SendOrder {
    type Req = {
        song: SongItem;
        className: string;
        userName: string;
        userId: string;
        offsetDay: number;
    }
}