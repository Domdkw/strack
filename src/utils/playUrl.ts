import xfetch from "../utils/xfetch";
import CryptoJS from "crypto-js";
import type { SongItem } from "../../shared/types/musicItem";
import type { MusicUrl } from "../../shared/types/api/music";

export function getExt(song: SongItem) {
    const platform = song.platform;
    const extObj: Record<string, unknown> = {};
    switch (platform) {
        case 'migu':
            extObj.contentId = song.contentId;
            extObj.songId = song.songId;
            extObj.copyrightId = song.copyrightId;
            break;
        default:
            return '';
    }
    return extObj ? CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(extObj))) : '';
}
export async function getPlayRes(song: SongItem) {
    const params: MusicUrl.Req.Song = {
        id: song.id,
        isVip: song.isVip || false,
        platform: song.platform,
        extStr: getExt(song) || undefined,
    }
    return await xfetch('/api/music/strategy/listen/url/v1.0', { params });
}