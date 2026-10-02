import type { SongItem } from "../../../shared/types/musicItem";
import { encryptLrcUrl } from "../../module/lyricGet";

function isVip(it: any) {
    return it?.showTags?.includes("vip");
}
function getSingerName(singerList: any[]) {
    return singerList?.map((singer: any) => singer.name).join('/') || '';
}
function formatSize(size: string) {
    const num = Math.round(Number(size) / 100000);
    return `${num / 10}MB`;
}
export function formatAlbumInfoItem(it: any) {
    return {
        id: it.contentId,
        title: it.songName,
        artist: getSingerName(it.singerList),
        album: it.album,
        duration: it.duration,
        artwork: it.img3,
        albumId: it.albumId,
        lrc: it.lrcUrl,
        //vip
        isVip: isVip(it),
        // new
        singerList: it.singerList,
        resourceType: String(it.resourceType),
        copyrightId: it.copyrightId,
    };
}
export function formatMusicItem(it: any): SongItem {
    return {
        platform: 'migu',
        id: it.contentId,
        title: it.songName,
        artist: getSingerName(it.singerList),
        album: it.album,
        duration: it.duration,
        artwork: "https://d.musicapp.migu.cn" + it.img3,
        albumId: it.albumId,
        lrc: encryptLrcUrl(it.lrcUrl, 'ahr3k69s'),
        //vip
        audioFormats: it.audioFormats,
        isVip: isVip(it),
        // new
        contentId: it.contentId,
        copyrightId: it.copyrightId,
        songId: it.songId,
        //singerList: it.singerList,
        //resourceType: String(it.resourceType),
        //playNumDesc: it.playNumDesc,
    };
}

export function formatSingerItem(it: any) {
    return {
        id: it.singerId,
        name: it.singer,
        fans: it.followNums,
        description: it.summary, //it.detail
        avatar: it.imgs[0].img,
        worksNum: it.songNum,
        //new
        resourceType: it.resourceType,
    };
}

export function formatAlbumItem(it: any) {
    return {
        id: it.albumId,
        title: it.title,
        artist: it.singer,
        artistId: it.singerId,
        artwork: it.imgItems[0].img,
        date: it.publishDate,
        // new
        resourceType: String(it.resourceType), // 2003
        totalCount: it.totalCount,
    };
}
