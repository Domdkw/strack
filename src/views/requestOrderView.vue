<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import { usePlayerStore } from "../stores/playerStore";
import type { SongItem } from "../../shared/types/musicItem.d.ts";
import type { Platform } from "../../shared/types/base";

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();

// URL 参数：与点歌接口 songItem 参数一致（id + platform）
const queryId = computed<string>(() => (route.query.id as string) || '');
const queryPlatform = computed<Platform | ''>(() => (route.query.platform as Platform) || '');

// 远程拉取的完整歌曲信息
const remoteSong = ref<SongItem | null>(null);
const fetching = ref(false);

// 点歌歌曲：优先用 URL 参数对应的歌曲（进入页面后从后端获取完整信息），否则用播放器当前歌曲
const song = computed<SongItem | null>(() => remoteSong.value || player.song);

onMounted(() => {
    if (queryId.value && queryPlatform.value) {
        void fetchSongInfo();
    }
});

async function fetchSongInfo(): Promise<void> {
    fetching.value = true;
    try {
        const res = await xfetch<SongItem>('/api/music/strategy/fullinfo/v1.0', {
            params: { id: queryId.value, platform: queryPlatform.value },
        });
        remoteSong.value = res ?? null;
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
    } finally {
        fetching.value = false;
    }
}

const MAX_OFFSET = 21;

// 日期选项（offsetDay 1..21，从明天起，只能为未来点歌）
type DayOption = { value: number; label: string };
const dayOptions = computed<DayOption[]>(() => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const list: DayOption[] = [];
    for (let i = 1; i <= MAX_OFFSET; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const tag = i === 1 ? '明天' : weekdays[d.getDay()];
        list.push({ value: i, label: `${mm}-${dd} ${tag}` });
    }
    return list;
});

// 班级选项：三个年级 × 每年级 20 个班，形如 101
type ClassOption = { value: string; label: string };
const classOptions = computed<ClassOption[]>(() => {
    const list: ClassOption[] = [];
    for (let grade = 1; grade <= 3; grade++) {
        for (let cls = 1; cls <= 20; cls++) {
            const value = `${grade}${String(cls).padStart(2, '0')}`;
            list.push({ value, label: value });
        }
    }
    return list;
});

const offsetDay = ref(1); // 默认明天（最早可点日期）
const className = ref('');
const userName = ref('');
const userId = ref('');
const submitting = ref(false);
const errorMsg = ref('');

async function onSubmit(): Promise<void> {
    if (submitting.value) return;
    if (!song.value) {
        errorMsg.value = '当前没有选择歌曲，请先播放或搜索一首';
        return;
    }
    if (!className.value.trim() || !userName.value.trim() || !userId.value.trim()) {
        errorMsg.value = '请完整填写班级、姓名、学号';
        return;
    }
    submitting.value = true;
    errorMsg.value = '';
    try {
        await xfetch<{ className: string }>('/api/order/column/modify/update/v1.0', {
            method: 'POST',
            body: {
                className: className.value.trim(),
                userName: userName.value.trim(),
                userId: userId.value.trim(),
                offsetDay: offsetDay.value,
                songItem: {
                    id: song.value.id,
                    platform: song.value.platform,
                },
            },
        });
        void router.push('/');
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-[#faf7f0] text-stone-800">
        <div class="mx-auto max-w-xl px-4 pb-28 pt-12">

            <!-- 标题 -->
            <header class="mb-8 text-center">
                <h1 class="text-3xl font-semibold tracking-wide text-stone-800">点歌</h1>
                <p class="mt-2 text-sm text-stone-400">把选中的歌曲送上栏目</p>
            </header>

            <!-- 当前歌曲 -->
            <div v-if="fetching" class="mb-6 border border-stone-200/70 bg-white px-4 py-6 text-center">
                <p class="text-sm text-stone-400">正在获取歌曲信息…</p>
            </div>
            <div v-else-if="song" class="mb-6 flex items-center gap-4 border border-stone-200/70 bg-white px-4 py-3">
                <img
                    v-if="song.artwork"
                    :src="song.artwork"
                    :alt="song.title"
                    class="h-12 w-12 shrink-0 bg-stone-100 object-cover"
                />
                <div v-else class="h-12 w-12 shrink-0 bg-stone-100"></div>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-stone-800">{{ song.title }}</p>
                    <p class="mt-0.5 truncate text-xs text-stone-400">
                        {{ song.artist }}<span v-if="song.album"> · {{ song.album }}</span>
                    </p>
                </div>
                <span class="shrink-0 border border-stone-200 px-2 py-0.5 text-xs text-stone-400">
                    {{ song.platform }}
                </span>
            </div>
            <div v-else class="mb-6 border border-dashed border-stone-300 bg-white px-4 py-6 text-center">
                <p class="text-sm text-stone-400">当前没有正在播放的歌曲</p>
                <RouterLink to="/search" class="mt-1 inline-block text-sm text-amber-700 underline">
                    去搜索一首
                </RouterLink>
            </div>

            <!-- 表单 -->
            <form class="border border-stone-200/70 bg-white p-6" @submit.prevent="onSubmit">
                <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label class="block">
                        <span class="mb-1.5 block text-xs font-medium text-stone-500">日期</span>
                        <select
                            v-model.number="offsetDay"
                            class="w-full border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none transition focus:border-amber-300"
                        >
                            <option v-for="opt in dayOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </label>

                    <label class="block">
                        <span class="mb-1.5 block text-xs font-medium text-stone-500">班级</span>
                        <select
                            v-model="className"
                            class="w-full border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none transition focus:border-amber-300"
                        >
                            <option value="" disabled>选择班级</option>
                            <option v-for="opt in classOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </label>

                    <label class="block">
                        <span class="mb-1.5 block text-xs font-medium text-stone-500">姓名</span>
                        <input
                            v-model="userName"
                            type="text"
                            placeholder="你的姓名"
                            class="w-full border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder-stone-300 outline-none transition focus:border-amber-300"
                        />
                    </label>

                    <label class="block">
                        <span class="mb-1.5 block text-xs font-medium text-stone-500">学号</span>
                        <input
                            v-model="userId"
                            type="text"
                            placeholder="你的学号"
                            class="w-full border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder-stone-300 outline-none transition focus:border-amber-300"
                        />
                    </label>
                </div>

                <p v-if="errorMsg" class="mt-4 text-sm text-red-500">{{ errorMsg }}</p>

                <button
                    type="submit"
                    :disabled="submitting"
                    class="mt-6 w-full border border-amber-200 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
                >
                    {{ submitting ? '提交中…' : '提交点歌' }}
                </button>
            </form>

        </div>
    </div>
</template>
