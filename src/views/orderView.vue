<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import type { ColumnEntry } from "../../shared/types/api/order.d.ts";
import type { SongItem } from "../../shared/types/musicItem.d.ts";
import type { OverviewDay, CalDay } from "../types/calendar";
import { formatTime } from "../utils/formatTime";
import { usePlayerStore } from "../stores/playerStore";
import CalendarGrid from "../components/calendarGrid.vue";

const player = usePlayerStore();

// ===== 预览数据（全部栏目摘要） =====
const overview = ref<Record<string, OverviewDay>>({});
const overviewLoading = ref(false);
const overviewError = ref('');

async function fetchOverview(): Promise<void> {
    overviewLoading.value = true;
    overviewError.value = '';
    try {
        const res = await xfetch<Record<string, OverviewDay>>('/api/order/column/index/all/v1.0');
        overview.value = res ?? {};
    } catch (err) {
        overviewError.value = getErrorMessage(err);
    } finally {
        overviewLoading.value = false;
    }
}

// ===== 详情浮层（点开某天） =====
const activeDay = ref(0);
const showDetail = ref(false);
const entries = ref<ColumnEntry[]>([]);
const loading = ref(false);
const errorMsg = ref('');

async function fetchColumn(offsetDay: number): Promise<void> {
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await xfetch<{ columns: ColumnEntry[]; timestamp: number }>(
            '/api/order/column/lookup/single/v1.0',
            { params: { offsetDay } }
        );
        entries.value = res?.columns ?? [];
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

function openDay(day: CalDay): void {
    if (day.disabled || loading.value) return;
    activeDay.value = day.offsetDay;
    showDetail.value = true;
    expandedFollows.value.clear();
    void fetchColumn(day.offsetDay);
}

function closeDetail(): void {
    showDetail.value = false;
}

const activeDateLabel = computed<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + activeDay.value);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
});

// 展开的跟随列表（按条目下标）
const expandedFollows = ref<Set<number>>(new Set());

function toggleFollow(idx: number, count: number): void {
    // 少于等于 5 人无需展开
    if (count <= 5) return;
    if (expandedFollows.value.has(idx)) {
        expandedFollows.value.delete(idx);
    } else {
        expandedFollows.value.add(idx);
    }
    expandedFollows.value = new Set(expandedFollows.value); // 触发响应式更新
}

function fmtTimestamp(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
}

function onPlay(song: SongItem): void {
    player.play(undefined, { song });
}

onMounted(() => {
    void fetchOverview();
});
</script>

<template>
    <div class="relative flex-1 overflow-hidden text-stone-800">
        <!-- 首页背景图 + 白色遮罩 -->
        <div class="absolute inset-0" aria-hidden="true">
            <img
                src="https://slzx.dgjy.net/images/banner.png"
                alt=""
                class="h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-white/60"></div>
        </div>

        <div class="relative mx-auto max-w-5xl px-4 pb-10 pt-8">

            <header class="mb-4 text-center">
                <h1 class="text-3xl font-semibold tracking-wide text-stone-800">东莞市石龙中学广播站</h1>
                <p class="mt-1.5 text-sm text-stone-400">栏目预览 · 点击日期查看当天栏目</p>
            </header>

            <p v-if="overviewError" class="mb-3 text-sm text-red-500">{{ overviewError }}</p>

            <CalendarGrid :overview="overview" @dayClick="openDay" />

        </div>

        <!-- 详情浮层：点开某天后的列表 -->
        <Teleport to="body">
            <div
                v-if="showDetail"
                class="fixed inset-0 z-[60] overflow-y-auto bg-stone-900/40"
                @click.self="closeDetail"
            >
                <div class="mx-auto my-16 w-[calc(100%-2rem)] max-w-2xl border border-stone-200/70 bg-white shadow-xl">
                    <header class="flex items-baseline justify-between border-b border-stone-100 px-4 py-3">
                        <h2 class="text-lg font-semibold text-stone-800">
                            栏目 <span class="ml-1 text-sm font-normal text-stone-400">{{ activeDateLabel }}</span>
                        </h2>
                        <div class="flex items-center gap-3">
                            <span class="text-xs text-stone-400">
                                {{ loading ? '加载中…' : `共 ${entries.length} 条` }}
                            </span>
                            <button
                                type="button"
                                class="text-stone-400 transition hover:text-stone-700"
                                @click="closeDetail"
                            >
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </header>

                    <p v-if="errorMsg" class="px-4 pt-3 text-sm text-red-500">{{ errorMsg }}</p>

                    <ul v-if="entries.length > 0" class="divide-y divide-stone-100">
                        <li
                            v-for="(entry, idx) in entries"
                            :key="idx"
                            class="group transition hover:bg-amber-50/60"
                        >
                            <!-- 主行：点击播放 -->
                            <div class="flex cursor-pointer items-center gap-4 px-4 py-2" @click="onPlay(entry.song)">
                                <img
                                    v-if="!!entry.song?.artwork"
                                    :src="entry.song.artwork"
                                    :alt="entry.song.title"
                                    class="h-12 w-12 shrink-0 bg-stone-100 object-cover"
                                    loading="lazy"
                                />
                                <div v-else class="h-12 w-12 shrink-0 bg-stone-100"></div>

                                <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium text-stone-800">{{ entry.song?.title }}</p>
                                    <p class="mt-0.5 truncate text-xs text-stone-400">
                                        {{ entry.song?.artist }}<span v-if="entry.song?.album"> · {{ entry.song.album }}</span>
                                    </p>
                                </div>

                                <span class="hidden w-16 shrink-0 truncate text-right text-xs text-stone-400 sm:block">
                                    {{ entry.userName }}
                                </span>
                                <span class="hidden w-20 shrink-0 truncate text-right text-xs text-stone-300 md:block">
                                    {{ entry.className }}
                                </span>
                                <span class="shrink-0 font-mono text-xs text-stone-300">{{ formatTime(entry.song?.duration ?? 0) }}</span>
                                <span class="w-10 shrink-0 text-right font-mono text-xs text-stone-300">{{ fmtTimestamp(entry.timestamp) }}</span>
                            </div>

                            <!-- 留言 -->
                            <p
                                v-if="entry.text"
                                class="border-t border-dashed border-stone-100 px-4 py-1.5 pl-20 text-xs text-stone-500"
                                @click.stop
                            >
                                {{ entry.text }}
                            </p>

                            <!-- 跟随子栏 -->
                            <div
                                v-if="entry.followUsers?.length"
                                class="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-stone-100 px-4 py-1.5 pl-20"
                                @click.stop
                            >
                                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                    {{ entry.followUsers.length }} 人跟随
                                </span>
                                <span
                                    v-for="u in (expandedFollows.has(idx) || entry.followUsers.length <= 3)
                                        ? entry.followUsers
                                        : entry.followUsers.slice(0, 3)"
                                    :key="u.userId"
                                    class="text-xs text-stone-400"
                                >
                                    {{ u.className }}·{{ u.userName }}
                                </span>
                                <button
                                    v-if="entry.followUsers.length > 3"
                                    type="button"
                                    class="text-xs text-amber-700 underline underline-offset-2"
                                    @click.stop="toggleFollow(idx, entry.followUsers.length)"
                                >
                                    {{ expandedFollows.has(idx) ? '收起' : `查看全部 ${entry.followUsers.length} 人` }}
                                </button>
                            </div>
                        </li>
                    </ul>

                    <!-- 空状态 -->
                    <div v-else class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                        <svg class="h-12 w-12 text-stone-200" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                        <p class="text-sm text-stone-400">{{ loading ? '正在加载栏目…' : '这一天还没有点播记录' }}</p>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
