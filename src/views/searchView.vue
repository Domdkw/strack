<script setup lang="ts">
import xfetch from "../utils/xfetch";
import type { MusicSearch } from "../../shared/types/api/music.d.ts";
import type { SongItem } from "../../shared/types/musicItem.d.ts";
import type { Platform } from "../../shared/types/base.d.ts";
import { formatTime } from "../utils/formatTime";
import { usePlayerStore } from "../stores/playerStore";

import { ref } from "vue";

//import HotSearch from "../components/hotSearch.vue";

const player = usePlayerStore();

const searchOrder = ref("");
const platform = ref<Platform>('migu');
const results = ref<SongItem[]>([]);
const loading = ref(false);
const searched = ref(false);

const page = ref(1);
const maxPage = 10;

async function fetchSongs(targetPage: number): Promise<SongItem[]> {
    const params: MusicSearch.Req.Song = {
        text: searchOrder.value.trim(),
        page: targetPage,
        size: 20,
        platform: platform.value,
    };
    return xfetch<SongItem[]>('/api/music/search/song/v1.0', { params });
}

async function onSearch(): Promise<void> {
    if (!searchOrder.value.trim() || loading.value) return;
    loading.value = true;
    page.value = 1;
    try {
        results.value = await fetchSongs(1);
        searched.value = true;
    } finally {
        loading.value = false;
    }
}

async function loadMore(): Promise<void> {
    if (!searchOrder.value.trim() || loading.value || page.value >= maxPage) return;
    loading.value = true;
    try {
        const more = await fetchSongs(page.value + 1);
        page.value += 1;
        results.value = results.value.concat(more);
    } finally {
        loading.value = false;
    }
}

</script>

<template>
    <div class="min-h-screen bg-[#faf7f0] text-stone-800">
        <div class="mx-auto max-w-3xl px-4 pb-28 pt-12">

            <!-- 标题 -->
            <header class="mb-8 text-center">
                <h1 class="text-3xl font-semibold tracking-wide text-stone-800">搜索音乐</h1>
                <p class="mt-2 text-sm text-stone-400">输入关键词，发现你喜欢的歌曲</p>
            </header>

            <!-- 搜索框 -->
            <div class="mb-8 flex justify-center">
                <div class="flex w-full max-w-xl items-center gap-3">
                    <!-- 音源选择 -->
                    <select
                        v-model="platform"
                        class="shrink-0 cursor-pointer rounded-full border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-sm outline-none transition focus:border-amber-300 focus:shadow-md"
                        aria-label="选择音源"
                    >
                        <option value="migu">咪咕</option>
                        <option value="ncm">网易云</option>
                    </select>
                    <div class="flex w-full items-center rounded-full border border-stone-200 bg-white px-5 py-3 shadow-sm transition focus-within:border-amber-300 focus-within:shadow-md">
                    <svg class="h-5 w-5 shrink-0 text-stone-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                    </svg>
                    <input
                        v-model="searchOrder"
                        @keyup.enter="onSearch"
                        type="text"
                        placeholder="搜索歌曲 / 歌手 / 专辑"
                        class="ml-3 w-full bg-transparent text-stone-700 placeholder-stone-400 outline-none"
                    />
                    <button
                        @click="onSearch"
                        :disabled="loading"
                        class="ml-3 shrink-0 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
                    >
                        {{ loading ? '搜索中…' : '搜索' }}
                    </button>
                    </div>
                </div>
            </div>

            <!-- 结果列表 -->
            <div class="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                <template v-if="results.length > 0">
                    <ul class="divide-y divide-stone-100">
                        <li
                            v-for="(song) in results"
                            :key="song.id"
                            @click="player.play(undefined, { song })"
                            class="group flex cursor-pointer items-center gap-4 px-4 py-2 transition hover:bg-amber-50/60"
                        >
                            <img
                                v-if="!!song.artwork"
                                :src="song.artwork"
                                :alt="song.title"
                                class="h-12 w-12 shrink-0 rounded-lg bg-stone-100 object-cover"
                                loading="lazy"
                            />
                            <div v-else class="h-6 w-4"></div>
                            <span class="min-w-0 flex-[2] truncate text-sm font-medium text-stone-800">{{ song.title }}</span>
                            <span class="hidden min-w-0 w-24 shrink-0 truncate text-right text-xs text-stone-400 md:block">{{ song.artist }}</span>
                            <span class="hidden min-w-0 flex-1 truncate text-xs text-stone-400 sm:block">{{ song.album }}</span>
                            <span class="shrink-0 w-12 text-right font-mono text-xs text-stone-300">{{ formatTime(song.duration) }}</span>
                        </li>
                    </ul>
                </template>

                <!-- 空状态 -->
                <div v-else class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <svg class="h-12 w-12 text-stone-200" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                    <p class="text-sm text-stone-400">{{ searched ? '没有找到相关歌曲' : '开始你的第一次搜索吧' }}</p>
                </div>
            </div>

            <!-- 加载更多 -->
            <div v-if="results.length > 0 && page < maxPage" class="mt-4 flex justify-center">
                <button
                    @click="loadMore"
                    :disabled="loading"
                    class="rounded-full border border-stone-200 bg-white px-6 py-2 text-sm font-medium text-stone-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                >
                    {{ loading ? '加载中…' : `加载更多（第 ${page} / ${maxPage} 页）` }}
                </button>
            </div>

        </div>
    </div>
</template>
