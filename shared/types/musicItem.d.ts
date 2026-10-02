export interface SongItem {
    platform: Platform; // 平台
    id: string | number; // 唯一id
    artist: string; // 作者
    album: string; // 专辑名
    title: string; // 标题
    duration: number; // 时长(s)
    artwork?: string; // 专辑封面图
    url?: string; // 默认音源
    lrc?: string; // 歌词URL
    rawLrc?: string; // 歌词
    qualities?: IMusic.IQuality; // 音质信息
    [k: string | number]: any;
}
