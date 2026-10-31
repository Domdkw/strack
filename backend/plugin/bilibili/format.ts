import type { SongItem } from "../../../shared/types/musicItem";
import type { BiliMediaItem } from "./index";

function durationToSec(duration: string | number): number {
    if (typeof duration === 'number') return duration;
    if (typeof duration === 'string') {
        return duration.split(':').reduce((prev, curr) => 60 * prev + Number(curr), 0);
    }
    return 0;
}

function decodeEntities(text: string): string {
    return text
        .replace(/<em[^>]*>|<\/em>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&nbsp;/g, ' ');
}

function fixPic(pic?: string): string | undefined {
    if (!pic) return undefined;
    return pic.startsWith('//') ? `https:${pic}` : pic;
}

export function formatBiliPublic(item: BiliMediaItem): SongItem {
    return {
        platform: 'bilibili',
        id: item.bvid ?? String(item.aid ?? item.cid ?? ''),
        title: decodeEntities(item.title ?? ''),
        artist: item.author ?? item.owner?.name ?? '',
        album: item.bvid ?? String(item.aid ?? ''),
        duration: durationToSec(item.duration ?? 0),
        // 音源获取依赖 aid/bvid
        aid: item.aid !== undefined ? String(item.aid) : undefined,
        bvid: item.bvid,
        cid: item.cid,
    }
}
export function formatBiliMedia(item: BiliMediaItem): SongItem {
    const publicItem = formatBiliPublic(item);
    publicItem.artwork = fixPic(item.pic);
    return publicItem;
}
