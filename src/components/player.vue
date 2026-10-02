<script setup lang="ts">
import { usePlayerStore } from "../stores/playerStore";
import { formatTime } from "../utils/formatTime";

import { onMounted } from "vue";

const player = usePlayerStore();

function close(): void {
    player.pause();
    player.$patch({ song: null });
}

onMounted(() => {
    player.bindAudioEvents();
});
</script>

<template>
    <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
    >
        <div
            v-if="player.song"
            class="fixed top-0 left-0 right-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur shadow-sm"
        >
            <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">

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
                    <span>{{ formatTime(player.currentTime) }}</span> / <span>{{ formatTime(player.duration) }}</span>
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

            <!-- 进度条 -->
            <div class="h-0.5 w-full bg-stone-100">
                <div
                    class="h-full bg-amber-300"
                    :style="{ width: player.duration ? `${(player.currentTime / player.duration) * 100}%` : '0%' }"
                ></div>
            </div>
        </div>
    </Transition>
</template>
