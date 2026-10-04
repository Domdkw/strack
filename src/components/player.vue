<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { usePlayerStore } from "../stores/playerStore";
import { formatTime } from "../utils/formatTime";

const player = usePlayerStore();

function close(): void {
    player.pause();
    player.$patch({ song: null });
}

// ===== 可拖动进度条 =====
const barEl = ref<HTMLElement | null>(null);
const scrubbing = ref(false);
const scrubTime = ref(0);

// 拖动中显示拖动位置，否则跟随实际播放进度
const shownTime = computed<number>(() => scrubbing.value ? scrubTime.value : player.currentTime);
const progressPct = computed<string>(() =>
    player.duration ? `${(shownTime.value / player.duration) * 100}%` : '0%'
);

function ratioToTime(e: PointerEvent): number {
    const el = barEl.value;
    if (!el || !player.duration) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return ratio * player.duration;
}

function onScrubStart(e: PointerEvent): void {
    if (!player.song || !player.duration) return;
    scrubbing.value = true;
    scrubTime.value = ratioToTime(e);
    const move = (ev: PointerEvent): void => { scrubTime.value = ratioToTime(ev); };
    const up = (ev: PointerEvent): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        player.seek(ratioToTime(ev));
        scrubbing.value = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

onMounted(() => {
    player.bindAudioEvents();
});
</script>

<template>
    <!-- 底部播放器：sticky 占位，固定高度 -->
    <footer class="sticky bottom-0 z-50 flex h-[72px] flex-col border-t border-stone-200 bg-white/95 backdrop-blur shadow-sm">
        <template v-if="player.song">
            <div class="mx-auto flex w-full max-w-3xl flex-1 items-center gap-3 overflow-hidden px-4">

                <img
                    v-if="player.song.artwork"
                    :src="player.song.artwork"
                    :alt="player.song.title"
                    class="h-11 w-11 shrink-0 rounded-lg bg-stone-100 object-cover"
                />
                <div v-else class="h-11 w-11 shrink-0 rounded-lg bg-stone-100"></div>

                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-stone-800">{{ player.song.title }}</p>
                    <p class="truncate text-xs text-stone-400">{{ player.song.artist }}</p>
                </div>

                <span class="shrink-0 font-mono text-xs text-stone-300">
                    <span>{{ formatTime(shownTime) }}</span> / <span>{{ formatTime(player.duration) }}</span>
                </span>

                <button
                    @click="player.setIsPlaying(!player.isPlaying)"
                    class="shrink-0 rounded-full bg-amber-100 p-2 text-amber-800 transition hover:bg-amber-200"
                    :aria-label="player.isPlaying ? '暂停' : '播放'"
                >
                    <svg v-if="!player.isPlaying" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <svg v-else class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                    </svg>
                </button>

                <button
                    @click="close"
                    class="shrink-0 rounded-full p-1.5 text-stone-300 transition hover:bg-stone-100 hover:text-stone-500"
                    aria-label="关闭"
                >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- 可拖动进度条 -->
            <div
                ref="barEl"
                class="group relative h-2 w-full cursor-pointer touch-none bg-stone-100"
                @pointerdown="onScrubStart"
            >
                <div class="absolute inset-y-0 left-0 bg-amber-400" :style="{ width: progressPct }"></div>
                <div
                    class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 transition-opacity"
                    :class="scrubbing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                    :style="{ left: progressPct }"
                ></div>
            </div>
        </template>

        <!-- 未播放时的占位（同样固定高度居中） -->
        <div v-else class="flex flex-1 items-center justify-center text-xs text-stone-300">
            未在播放
        </div>
    </footer>
</template>
