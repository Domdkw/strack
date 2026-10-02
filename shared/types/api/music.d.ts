import type { SongItem } from "../musicItem";
import type { Platform } from "../base";


export namespace MusicSearch {
    namespace Req {
        type Song = {
            text: string;
            page: number;
            size: number;
            platform: Platform;
        }
    }
}
export namespace MusicUrl {
    namespace Req {
        type Song = {
            id: string|number;
            isVip?: boolean;
            extStr?: string;
            platform: Platform;
        }
    }
}
