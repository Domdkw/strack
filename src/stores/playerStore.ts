import { defineStore } from 'pinia';
import { getPlayRes } from "../utils/playUrl";
import type { SongItem } from "../../shared/types/musicItem";

// Audio 实例放在 store 外部，避免被 Vue 响应式代理
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
    if (!audio) {
        audio = new Audio();
    }
    return audio;
}

export const usePlayerStore = defineStore('player', {
    state: () => ({
        isPlaying: false,
        song: null as SongItem | null,
        showLyric: true,
        currentTime: 0,
        duration: 0,
    }),
    actions: {
        setIsPlaying(isPlaying: boolean) {
            const a = getAudio();
            if (isPlaying) {
                a.play().catch((err: Error) => console.error('[player] play failed:', err));
            } else {
                a.pause();
            }
            this.isPlaying = isPlaying;
        },
        setSong(song: SongItem) {
            this.song = song;
            if (song?.url) {
                const a = getAudio();
                if (a.src !== song.url) {
                    a.src = song.url;
                    this.currentTime = 0;
                }
            }
        },
        async play(url?: string, {
            showLyric = false,
            song,
        }: { showLyric?: boolean; song?: SongItem | null } = {}) {
            const a = getAudio();
            if (song) {
                if (song.id == this.song?.id && song.platform == this.song?.platform){ // ==: 不检查类型
                    // 同一首歌：回到开头重新播放
                    this.seek(0);
                    this.setIsPlaying(true);
                    return;
                }
                this.setSong(song);
            }
            // 自动获取播放地址：显式 url 优先，其次 song.url，最后调接口
            if (this.song) {
                let remoteInfo: SongItem | undefined;
                let target: string = url || this.song.url || '';
                if (!target) {
                    remoteInfo = await getPlayRes(this.song)
                    target = remoteInfo?.url || '';
                    this.song = {...this.song, ...remoteInfo};// 合并更新 song 信息
                }
                if (target && a.src !== target) {
                    a.src = target;
                    this.currentTime = 0;
                }
            }
            this.showLyric = showLyric;
            this.setIsPlaying(true);
        },
        pause() {
            this.setIsPlaying(false);
        },
        /** 控制播放进度（秒）。元数据未加载时等 loadedmetadata 再 seek */
        seek(time: number): void {
            const a = getAudio();
            const doSeek = (): void => {
                a.currentTime = time;
                this.currentTime = time;
            };
            if (a.readyState >= 1) { // HAVE_METADATA
                doSeek();
            } else {
                a.addEventListener('loadedmetadata', doSeek, { once: true });
            }
        },
        bindAudioEvents(): void {
            const a = getAudio();
            a.addEventListener('play', () => { this.isPlaying = true; });
            a.addEventListener('pause', () => { this.isPlaying = false; });
            a.addEventListener('ended', () => { this.isPlaying = false; });
            // timeupdate 约 250ms 触发一次，这里按整数秒去重，每秒只写入一次
            a.addEventListener('timeupdate', () => {
                if (Math.floor(a.currentTime) !== Math.floor(this.currentTime)) {
                    this.currentTime = a.currentTime;
                }
            });
            a.addEventListener('durationchange', () => { this.duration = a.duration; });
        },
    }
});
