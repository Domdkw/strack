<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import type { ColumnEntry } from "../../shared/types/api/order.d.ts";
import type { SongItem } from "../../shared/types/musicItem.d.ts";
import { formatTime } from "../utils/formatTime";
import { usePlayerStore } from "../stores/playerStore";

const player = usePlayerStore();

const MAX_OFFSET = 21;

// 预览接口返回的单天摘要
type OverviewSong = { artwork?: string; title: string; followCount: number };
type OverviewDay = { songs: OverviewSong[]; timestamp: number };

// 日历单元格：null 表示占位空白
type CalDay = {
    offsetDay: number;   // 距今天的天数（0=今天，负数=过去）
    day: number;         // 几号
    isToday: boolean;
    disabled: boolean;   // 不可查看（过去或超出 21 天）
    songs: OverviewSong[];
};
type CalMonth = { year: number; month: number; weeks: (CalDay | null)[][] };

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

// 与后端 getOffsetIndex 一致的日期 key（Asia/Shanghai，yyyy-MM-dd）
function dateKey(d: Date): string {
    return d.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '-');
}

// ===== 预览数据（全部栏目摘要） =====
const overview = ref<Record<string, OverviewDay>>({});
const overviewLoading = ref(false);
const overviewError = ref('');

async function fetchOverview(): Promise<void> {
    overviewLoading.value = true;
    overviewError.value = '';
    try {
        const res = await xfetch<Record<string, OverviewDay>>('/api/order/column/lookup/all/v1.0');
        overview.value = res ?? {};
    } catch (err) {
        overviewError.value = getErrorMessage(err);
    } finally {
        overviewLoading.value = false;
    }
}

// 日历：从本月 1 号铺到今天+21 所在月的月末，无法查看的天置灰
const calendar = computed<CalMonth[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(today);
    last.setDate(last.getDate() + MAX_OFFSET);

    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth() + 1, 0); // 所在月月末

    const months: CalMonth[] = [];
    let cur: CalMonth | null = null;
    let week: (CalDay | null)[] = [];

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const monthKey = d.getFullYear() * 100 + d.getMonth();
        if (!cur || cur.year * 100 + cur.month !== monthKey) {
            if (cur && week.length) {
                while (week.length < 7) week.push(null); // 月末补齐
                cur.weeks.push(week);
            }
            week = [];
            cur = { year: d.getFullYear(), month: d.getMonth(), weeks: [] };
            months.push(cur);
            for (let i = 0; i < d.getDay(); i++) week.push(null); // 月初对齐周日
        }
        if (week.length === 7) { cur.weeks.push(week); week = []; }
        const offsetDay = Math.round((d.getTime() - today.getTime()) / 86400000);
        const key = dateKey(d);
        week.push({
            offsetDay,
            day: d.getDate(),
            isToday: offsetDay === 0,
            disabled: offsetDay < 0 || offsetDay > MAX_OFFSET,
            songs: overview.value[key]?.songs ?? [],
        });
    }
    if (cur && week.length) {
        while (week.length < 7) week.push(null);
        cur.weeks.push(week);
    }
    return months;
});

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
    // 少于等于 3 人无需展开
    if (count <= 3) return;
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
    <div class="min-h-screen bg-[#faf7f0] text-stone-800">
        <div class="mx-auto max-w-5xl px-4 pb-28 pt-10">

            <header class="mb-4 flex items-baseline justify-between">
                <h1 class="text-2xl font-semibold tracking-wide text-stone-800">栏目预览</h1>
                <span class="text-xs text-stone-400">
                    {{ overviewLoading ? '加载中…' : '点击日期查看当天栏目' }}
                </span>
            </header>

            <p v-if="overviewError" class="mb-3 text-sm text-red-500">{{ overviewError }}</p>

            <div v-for="month in calendar" :key="`${month.year}-${month.month}`" class="mb-8">
                <h2 class="mb-2 px-1 text-sm font-medium text-stone-500">
                    {{ month.year }}年{{ month.month + 1 }}月
                </h2>
                <div class="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400">
                    <span v-for="w in weekdays" :key="w">{{ w }}</span>
                </div>
                <div class="space-y-1">
                    <div
                        v-for="(week, wi) in month.weeks"
                        :key="wi"
                        class="grid grid-cols-7 gap-1"
                    >
                        <template v-for="(day, di) in week" :key="di">
                            <span v-if="!day"></span>
                            <button
                                v-else
                                type="button"
                                :disabled="day.disabled"
                                @click="openDay(day)"
                                class="relative flex h-24 w-full flex-col items-start rounded-sm p-1.5 text-left transition"
                                :class="[
                                    day.disabled
                                        ? 'cursor-not-allowed bg-stone-100/70 text-stone-300'
                                        : 'bg-white ring-1 ring-stone-200/70 hover:ring-amber-400',
                                ]"
                            >
                                <!-- 日期数字：左上角 -->
                                <span
                                    class="text-[11px] font-medium leading-none"
                                    :class="[
                                        day.disabled
                                            ? 'text-stone-300'
                                            : day.isToday
                                                ? 'text-amber-700'
                                                : 'text-stone-500',
                                    ]"
                                >
                                    {{ day.day }}
                                    <span v-if="day.isToday" class="ml-0.5 text-[9px]">今天</span>
                                </span>

                                <!-- 歌曲封面（小圆圈） -->
                                <div class="mt-1.5 flex w-full flex-wrap items-center gap-1">
                                    <div
                                        v-for="(s, si) in day.songs.slice(0, 4)"
                                        :key="si"
                                        class="group/art relative h-7 w-7 shrink-0"
                                    >
                                        <img
                                            v-if="s.artwork"
                                            :src="s.artwork"
                                            :alt="s.title"
                                            class="h-7 w-7 rounded-full bg-stone-100 object-cover"
                                            loading="lazy"
                                        />
                                        <div v-else class="h-7 w-7 rounded-full bg-stone-100"></div>
                                        <!-- hover 时圆圈上显示跟随人数（含点歌人 +1） -->
                                        <span class="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-full bg-stone-900/45 text-[10px] font-medium leading-none text-white group-hover/art:flex">
                                            {{ s.followCount + 1 }}
                                        </span>
                                    </div>
                                    <span v-if="day.songs.length > 4" class="text-[10px] text-stone-400">
                                        +{{ day.songs.length - 4 }}
                                    </span>
                                </div>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

        </div>

        <!-- 详情浮层：点开某天后的列表 -->
        <Teleport to="body">
            <div
                v-if="showDetail"
                class="fixed inset-0 z-40 overflow-y-auto bg-stone-900/40"
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

                            <!-- 跟随子栏 -->
                            <div
                                v-if="entry.followUsers?.length"
                                class="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-stone-100 px-4 py-1.5 pl-20"
                                @click.stop
                            >
                                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                                    </svg>
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
