<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import type { ColumnEntry } from "../../shared/types/api/order.d.ts";
import type { SongItem } from "../../shared/types/musicItem.d.ts";
import type { OverviewDay, CalDay } from "../types/calendar";
import { formatTime } from "../utils/formatTime";
import { usePlayerStore } from "../stores/playerStore";
import CalendarGrid from "../components/calendarGrid.vue";

const router = useRouter();
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
// 已点选过某天（用于立即高亮，不必等数据返回）
const daySelected = ref(false);
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

async function openDay(day: CalDay): Promise<void> {
    if (day.disabled || loading.value) return;
    // 点击的仍是当前已选中的日期：直接复用已有数据，不重复请求
    if (daySelected.value && activeDay.value === day.offsetDay) return;
    activeDay.value = day.offsetDay;
    daySelected.value = true;
    expandedFollows.value.clear();

    if (showDetail.value) {
        // 已展开时原地刷新，保留当前列表，等新数据返回后整体替换（避免高度抖动）
        void fetchColumn(day.offsetDay);
        return;
    }

    // 首次打开：先读取数据，成功后再显示面板，避免先出现空状态导致闪动
    await fetchColumn(day.offsetDay);
    showDetail.value = true;
    // 移动端列表在日历下方，选中后滚动到列表顶部，避免用户以为没有反应
    if (window.matchMedia('(max-width: 639px)').matches) {
        void nextTick(() => detailPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
}

function closeDetail(): void {
    showDetail.value = false;
    daySelected.value = false;
}

// 仅桌面端点击遮罩关闭；移动端详情为全屏面板，避免误触空白区域关闭
function onBackdropClick(): void {
    if (window.matchMedia('(min-width: 640px)').matches) closeDetail();
}

const activeDateLabel = computed<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + activeDay.value);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
});

// 展开的跟随列表（按条目下标）
const expandedFollows = ref<Set<number>>(new Set());
const detailPanel = ref<HTMLElement | null>(null);

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

// 带着当前查看日期去搜歌并点歌（仅支持未来日期）
function goOrder(): void {
    if (activeDay.value < 1) return;
    void router.push({ path: '/search', query: { offsetDay: String(activeDay.value) } });
}

onMounted(() => {
    void fetchOverview();
});
</script>

<template>
    <!-- flex-1 在 flex 滚动容器中可同时做到"撑满可视高度"与"内容超高时撑出滚动" -->
    <div class="relative flex-1 text-stone-800">
        <!-- 顶部区域（标题 + 日历）：背景图铺满整屏高度（扣除顶部导航 3.25rem），下方列表为纯白 -->
        <section class="relative min-h-[calc(100vh-3.25rem)]">
            <div class="absolute inset-0" aria-hidden="true">
                <img
                    src="https://slzx.dgjy.net/images/banner.png"
                    alt=""
                    class="h-full w-full object-cover"
                />
                <div class="absolute inset-0 bg-white/60"></div>
            </div>

            <div class="relative mx-auto max-w-5xl px-4 pb-6 pt-8">
                <header class="mb-4 text-center">
                    <h1 class="text-3xl font-semibold tracking-wide text-stone-800">东莞市石龙中学广播站</h1>
                    <p class="mt-1.5 text-sm text-stone-400">栏目预览 · 点击日期查看当天栏目</p>
                </header>

                <p v-if="overviewError" class="mb-3 text-sm text-red-500">{{ overviewError }}</p>

                <CalendarGrid
                    :overview="overview"
                    :selected="daySelected ? [activeDay] : []"
                    @dayClick="openDay"
                />
            </div>
        </section>

        <div class="mx-auto max-w-5xl px-4 pb-10">

        <!-- 详情：移动端与日历竖向排列（整页滚动），桌面端为居中浮层 -->
        <div
            v-if="showDetail"
            ref="detailPanel"
            class="-mx-4 mt-4 w-auto sm:fixed sm:inset-0 sm:z-[60] sm:m-0 sm:mx-0 sm:w-auto sm:overflow-y-auto sm:bg-stone-900/40"
            @click.self="onBackdropClick"
        >
            <div class="w-full border border-stone-200/70 bg-white sm:mx-auto sm:my-16 sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:shadow-xl">
                <header class="flex items-baseline justify-between border-b border-stone-100 bg-white px-4 py-3 sm:sticky sm:top-0 sm:z-10">
                    <h2 class="text-lg font-semibold text-stone-800">
                        栏目 <span class="ml-1 text-sm font-normal text-stone-400">{{ activeDateLabel }}</span>
                    </h2>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-stone-400">
                            {{ loading ? '加载中…' : `共 ${entries.length} 条` }}
                        </span>
                        <button
                            type="button"
                            :disabled="activeDay < 1"
                            :title="activeDay < 1 ? '只能为未来日期点歌' : '为该日期点歌'"
                            class="border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                            @click="goOrder"
                        >
                            +
                        </button>
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
                        <div class="flex cursor-pointer items-center gap-3 px-4 py-2 sm:gap-4" @click="onPlay(entry.song)">
                            <img
                                v-if="!!entry.song?.artwork"
                                :src="entry.song.artwork"
                                :alt="entry.song.title"
                                class="h-10 w-10 shrink-0 bg-stone-100 object-cover sm:h-12 sm:w-12"
                                loading="lazy"
                            />
                            <div v-else class="h-10 w-10 shrink-0 bg-stone-100 sm:h-12 sm:w-12"></div>

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
                            class="border-t border-dashed border-stone-100 px-4 py-1.5 pl-16 text-xs text-stone-500 sm:pl-20"
                            @click.stop
                        >
                            {{ entry.text }}
                        </p>

                        <!-- 跟随子栏 -->
                        <div
                            v-if="entry.followUsers?.length"
                            class="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-stone-100 px-4 py-1.5 pl-16 sm:pl-20"
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
                <div v-else class="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:py-16">
                    <svg class="h-12 w-12 text-stone-200" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                    <p class="text-sm text-stone-400">{{ loading ? '正在加载栏目…' : '这一天还没有点播记录' }}</p>
                </div>
            </div>
        </div>
        </div>
    </div>
</template>
