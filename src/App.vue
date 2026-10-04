<template>
    <RouterView />
    <Player />
    <nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur">
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
</template>

<script setup>
import Player from './components/player.vue';
</script>
