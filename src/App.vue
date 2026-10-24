<template>
    <div class="flex h-screen flex-col overflow-hidden">
        <!-- 顶部导航 -->
        <nav class="shrink-0 border-b border-stone-200 bg-white/95 backdrop-blur">
            <div class="mx-auto flex max-w-3xl items-center justify-around px-4 py-2.5">
                <RouterLink
                    to="/"
                    class="px-6 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-amber-50 hover:text-amber-700"
                    exact-active-class="bg-amber-100 text-amber-800"
                >Order</RouterLink>
                <RouterLink
                    to="/search"
                    class="px-6 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-amber-50 hover:text-amber-700"
                    exact-active-class="bg-amber-100 text-amber-800"
                >Search</RouterLink>
            </div>
        </nav>

        <!-- 页面内容（内部滚动，导航固定；播放时预留底部空间避免被悬浮播放栏遮挡） -->
        <div
            class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
            :class="player.song ? 'pb-24' : 'pb-0'"
        >
            <RouterView />
        </div>

        <!-- 底部悬浮播放器：仅在播放时渲染 -->
        <Player />
    </div>
</template>

<script setup>
import Player from './components/player.vue';
import { usePlayerStore } from './stores/playerStore';

const player = usePlayerStore();
</script>
