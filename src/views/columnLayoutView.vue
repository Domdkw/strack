<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import type { ColumnEntry, OrderExchange, OrderSong } from "../../shared/types/api/order.d.ts";
import type { OverviewDay } from "../types/calendar";
import { formatTime } from "../utils/formatTime";

// 栏目排版台：
// - 上方日历提供可拖拽的「日期块」，拖到下方排版区生成栏目列
// - 栏目列横向排列，通过列顶部把手线横向排序（仅影响排版视图）
// - 栏目内歌曲可拖拽调整：拖到其他列 = 转移到那一天（调 exchange 接口）；拖回本列 = 移到列尾
const router = useRouter();

type ColumnIdentify = {
    className: string;
    userName: string;
    userId: string;
    songItem: OrderSong;
};
type LayoutCol = {
    offsetDay: number;
    entries: ColumnEntry[];
    loading: boolean;
    error: string;
};

// ===== 鉴权（与 adminView 相同的模式） =====
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('adminToken') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function onAuthError(err: unknown): void {
    const code = (err as { code?: number })?.code;
    if (code === 301 || code === 303 || code === 304) {
        localStorage.removeItem('admin');
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
    }
}

// ===== 提示条 =====
const toastMsg = ref('');
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
    toastMsg.value = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastMsg.value = ''), 2600);
}

// ===== 全局概览（日历角标 + 禁用状态） =====
const overview = ref<Record<string, OverviewDay>>({});
const overviewError = ref('');

function dateKey(d: Date): string {
    return d.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\//g, '-');
}

async function fetchOverview(): Promise<void> {
    overviewError.value = '';
    try {
        const res = await xfetch<Record<string, OverviewDay>>('/api/order/column/index/all/v1.0', {
            headers: authHeaders(),
        });
        overview.value = res ?? {};
    } catch (err) {
        overviewError.value = getErrorMessage(err);
        onAuthError(err);
    }
}

// ===== 排版区：栏目列 =====
const layoutCols = ref<LayoutCol[]>([]);

// ===== 迷你日历（日期块可拖拽 / 点击加入排版区） =====
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_OFFSET = 21;

type MiniDay = {
    offsetDay: number;
    day: number;
    isToday: boolean;
    disabled: boolean;        // 超出范围（过去 / 超过最大跨度）
    forbidden: boolean;       // 管理员禁用日
    count: number;            // 当天歌曲数
    onBoard: boolean;         // 已在排版区
    monthLabel: string | null;
};

const calendar = computed<(MiniDay | null)[][]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(today);
    last.setDate(last.getDate() + MAX_OFFSET);
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - last.getDay()));

    const weeks: (MiniDay | null)[][] = [];
    let row: (MiniDay | null)[] = [];
    let prevMonth = -1;
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const offsetDay = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (row.length === 7) { weeks.push(row); row = []; }
        if (d.getMonth() !== prevMonth) {
            prevMonth = d.getMonth();
        }
        const key = dateKey(d);
        const day: MiniDay = {
            offsetDay,
            day: d.getDate(),
            isToday: offsetDay === 0,
            disabled: offsetDay < 0 || offsetDay > MAX_OFFSET,
            forbidden: overview.value[key]?.disabled === true,
            count: overview.value[key]?.songs.length ?? 0,
            onBoard: layoutCols.value.some(c => c.offsetDay === offsetDay),
            monthLabel: d.getDate() === 1 ? `${d.getMonth() + 1}月` : null,
        };
        row.push(day);
    }
    if (row.length) weeks.push(row);
    return weeks;
});

function weekdayOf(offsetDay: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDay);
    return `周${WEEKDAYS[d.getDay()]}`;
}
function dateLabelOf(offsetDay: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDay);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ===== 栏目数据加载 / 增删 =====
const saving = ref(false);

async function fetchColumn(offsetDay: number): Promise<void> {
    const col = layoutCols.value.find(c => c.offsetDay === offsetDay);
    if (!col) return;
    col.loading = true;
    col.error = '';
    try {
        const res = await xfetch<{ columns: ColumnEntry[]; timestamp: number }>(
            '/api/order/column/lookup/single/v1.0',
            { params: { offsetDay }, headers: authHeaders() },
        );
        col.entries = res?.columns ?? [];
        snapshot.value[offsetDay] = col.entries.slice(); // 记录服务端原始顺序，供撤销
    } catch (err) {
        col.error = getErrorMessage(err);
        onAuthError(err);
    } finally {
        col.loading = false;
    }
}

function addColumn(offsetDay: number): void {
    if (layoutCols.value.some(c => c.offsetDay === offsetDay)) {
        toast(`${dateLabelOf(offsetDay)}已在排版区`);
        return;
    }
    layoutCols.value.push({ offsetDay, entries: [], loading: true, error: '' });
    void fetchColumn(offsetDay);
}

function removeColumn(offsetDay: number): void {
    layoutCols.value = layoutCols.value.filter(c => c.offsetDay !== offsetDay);
    // 该列的未保存改动一并丢弃，避免残留悬空引用
    pending.value = pending.value.filter(p => p.fromDay !== offsetDay && p.targetDay !== offsetDay);
    delete snapshot.value[offsetDay];
}

async function refreshCols(days: number[]): Promise<void> {
    await Promise.all([...new Set(days)].map(d => fetchColumn(d)));
}

// ===== 暂存：拖拽只改本地预览，点「保存」一次性提交 =====
type PendingMove = {
    fromDay: number;
    origin: ColumnIdentify;
    targetDay: number;
    entry: ColumnEntry;
};
const pending = ref<PendingMove[]>([]);
const snapshot = ref<Record<number, ColumnEntry[]>>({}); // 服务端原始顺序

const dirtyCount = computed<number>(() => pending.value.length);

function identifyOf(entry: ColumnEntry): ColumnIdentify | null {
    if (!entry?.song) return null;
    return {
        className: entry.className,
        userName: entry.userName,
        userId: entry.userId,
        songItem: { id: entry.song.id, platform: entry.song.platform },
    };
}

function colPendingCount(day: number): number {
    return pending.value.filter(p => p.fromDay === day || p.targetDay === day).length;
}

// 本地预览：把条目从源列移到目标列尾部（与后端 append 行为一致）
function stageMove(fromDay: number, targetDay: number, entry: ColumnEntry): void {
    const origin = identifyOf(entry);
    if (!origin) {
        toast('该条目缺少歌曲信息，无法移动');
        return;
    }
    const from = layoutCols.value.find(c => c.offsetDay === fromDay);
    const to = layoutCols.value.find(c => c.offsetDay === targetDay);
    if (!from || !to) return;

    const idx = from.entries.indexOf(entry);
    if (idx < 0) return;
    if (fromDay === targetDay && idx === from.entries.length - 1) return; // 已在列尾

    from.entries.splice(idx, 1);
    to.entries.push(entry);
    pending.value.push({ fromDay, origin, targetDay, entry });
}

// 批量保存：把暂存的交换一次性提交给 /api/admin/column/row/exchange
async function saveAll(): Promise<void> {
    if (saving.value || pending.value.length === 0) return;
    saving.value = true;
    const count = pending.value.length;
    const days = [...new Set(pending.value.flatMap(p => [p.fromDay, p.targetDay]))];
    try {
        const body: OrderExchange = pending.value.map(p => ({
            from: { offsetDay: p.fromDay, origin: p.origin },
            targetOffsetDay: p.targetDay,
        }));
        const res = await xfetch<{ exchanged: number }>('/api/admin/column/row/exchange/v1.0', {
            method: 'POST',
            headers: authHeaders(),
            body,
        });
        const n = res?.exchanged ?? 0;
        pending.value = [];
        toast(n > 0 ? `已保存 ${count} 项改动 · 共移动 ${n} 首歌曲` : '没有实际移动的歌曲');
        await refreshCols(days);
        void fetchOverview();
    } catch (err) {
        toast(getErrorMessage(err));
        onAuthError(err);
    } finally {
        saving.value = false;
    }
}

// 撤销所有未保存改动：恢复各列的服务端原始顺序
function undoAll(): void {
    if (!pending.value.length) return;
    for (const [day, list] of Object.entries(snapshot.value)) {
        const col = layoutCols.value.find(c => c.offsetDay === Number(day));
        if (col && !col.loading) col.entries = list.slice();
    }
    pending.value = [];
    toast('已撤销未保存的改动');
}

// ===== 拖拽状态（HTML5 DnD，kind 在 dragstart 时记录于组件状态） =====
type DragKind = '' | 'day' | 'song' | 'col';
const dragKind = ref<DragKind>('');
const dragDay = ref<number | null>(null);
const dragColDay = ref<number | null>(null);       // 正在拖拽把手的列
const dragSong = ref<{ day: number; entry: ColumnEntry } | null>(null);
const dropHint = ref<{ day: number; side: 'left' | 'right' } | null>(null); // 列间插入指示
const areaOver = ref(false); // 空排版区悬停高亮

function setDragData(e: DragEvent, payload: string): void {
    // Firefox 必须调用 setData 才能触发拖拽
    e.dataTransfer?.setData('text/plain', payload);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove';
}

function onDayDragStart(day: MiniDay, e: DragEvent): void {
    if (day.disabled) { e.preventDefault(); return; }
    dragKind.value = 'day';
    dragDay.value = day.offsetDay;
    setDragData(e, `day:${day.offsetDay}`);
}
function onSongDragStart(col: LayoutCol, entry: ColumnEntry, e: DragEvent): void {
    dragKind.value = 'song';
    dragSong.value = { day: col.offsetDay, entry };
    setDragData(e, `song:${col.offsetDay}:${entry.userId}:${entry.song?.id ?? ''}`);
}
function onColHandleDragStart(col: LayoutCol, e: DragEvent): void {
    dragKind.value = 'col';
    dragColDay.value = col.offsetDay;
    setDragData(e, `col:${col.offsetDay}`);
}

function onDragEnd(): void {
    dragKind.value = '';
    dragDay.value = null;
    dragColDay.value = null;
    dragSong.value = null;
    dropHint.value = null;
    areaOver.value = false;
}

// ---- 排版区（空白处 / 整体）：接收日期块 ----
function onAreaDragOver(e: DragEvent): void {
    if (dragKind.value !== 'day') return;
    e.preventDefault();
    const target = e.target as HTMLElement;
    areaOver.value = !target.closest('.col-card');
}
function onAreaDragLeave(): void {
    areaOver.value = false;
}
function onAreaDrop(e: DragEvent): void {
    e.preventDefault();
    if (dragKind.value === 'day' && dragDay.value !== null) {
        addColumn(dragDay.value);
    }
    onDragEnd();
}

// ---- 栏目列：接收歌曲交换 / 日期块 / 把手排序 ----
function onColDragOver(col: LayoutCol, e: DragEvent): void {
    if (dragKind.value === '') return;
    e.preventDefault();
    e.stopPropagation();
    if (dragKind.value === 'col') {
        if (col.offsetDay === dragColDay.value) { dropHint.value = null; return; }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dropHint.value = {
            day: col.offsetDay,
            side: e.clientX < rect.left + rect.width / 2 ? 'left' : 'right',
        };
    }
    areaOver.value = false;
}

function onColDrop(col: LayoutCol, e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (dragKind.value === 'song' && dragSong.value) {
        const { day, entry } = dragSong.value;
        stageMove(day, col.offsetDay, entry); // 只改本地预览，等待保存
        onDragEnd();
        return;
    }
    if (dragKind.value === 'day' && dragDay.value !== null) {
        addColumn(dragDay.value);
        onDragEnd();
        return;
    }
    if (dragKind.value === 'col' && dragColDay.value !== null) {
        reorderCols(dragColDay.value, col.offsetDay);
        onDragEnd();
    }
}

function reorderCols(fromDay: number, targetDay: number): void {
    if (fromDay === targetDay) return;
    const cols = layoutCols.value;
    const fromIdx = cols.findIndex(c => c.offsetDay === fromDay);
    if (fromIdx < 0) return;
    const side = dropHint.value?.day === targetDay ? dropHint.value.side : 'left';
    const [moved] = cols.splice(fromIdx, 1);
    let to = cols.findIndex(c => c.offsetDay === targetDay);
    if (to < 0) { cols.splice(fromIdx, 0, moved); return; }
    if (side === 'right') to += 1;
    cols.splice(to, 0, moved);
}

// 插入指示条：目标列左侧，或前一列的右侧
function showHintBefore(day: number): boolean {
    const hint = dropHint.value;
    if (!hint || dragKind.value !== 'col') return false;
    const cols = layoutCols.value;
    const idx = cols.findIndex(c => c.offsetDay === day);
    const prev = idx > 0 ? cols[idx - 1]?.offsetDay : null;
    return (hint.day === day && hint.side === 'left') || (prev !== null && hint.day === prev && hint.side === 'right');
}
function showHintAfterLast(): boolean {
    const hint = dropHint.value;
    if (!hint || dragKind.value !== 'col') return false;
    const cols = layoutCols.value;
    return hint.day === cols[cols.length - 1]?.offsetDay && hint.side === 'right';
}

// ===== 统计 =====
const totalSongs = computed<number>(() =>
    layoutCols.value.reduce((sum, c) => sum + c.entries.length, 0),
);

onMounted(() => {
    // 首次进入先拉取日历概览（日期块的歌曲数 / 禁用状态），再铺上今天
    void fetchOverview()/*.then(() => {
        if (layoutCols.value.length === 0) addColumn(0);
    })*/;
});
</script>

<template>
    <div class="lay-page relative flex-1 text-stone-800">
        <div class="relative mx-auto max-w-6xl px-4 pb-16 pt-8">
            <!-- 页头 -->
            <header class="mb-5 flex items-end justify-between gap-4">
                <div>
                    <RouterLink
                        to="/admin"
                        class="mb-2 inline-flex items-center gap-1 text-xs text-stone-400 transition hover:text-amber-600"
                    >
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        返回栏目管理
                    </RouterLink>
                    <h1 class="text-2xl font-semibold tracking-wide">
                        栏目排版台
                        <span class="ml-1 align-middle font-mono text-[10px] font-normal uppercase tracking-[0.3em] text-amber-600">On Air</span>
                    </h1>
                    <p class="mt-1 text-sm text-stone-400">
                        拖动日期块到下方排版区生成栏目列 · 拉动列顶部把手横向排序 · 歌曲可拖到其他日期
                    </p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-2">
                    <div class="text-right font-mono text-xs leading-5 text-stone-400">
                        <p>{{ layoutCols.length }} 列 · {{ totalSongs }} 首</p>
                        <p :class="dirtyCount || saving ? 'text-amber-600' : 'text-emerald-600'">
                            {{ saving ? '保存中…' : dirtyCount ? `${dirtyCount} 项未保存` : '已同步' }}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            :disabled="dirtyCount === 0 || saving"
                            class="rounded-sm border border-stone-200 px-3 py-1.5 text-sm text-stone-500 transition hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                            @click="undoAll"
                        >
                            撤销
                        </button>
                        <button
                            type="button"
                            :disabled="dirtyCount === 0 || saving"
                            class="rounded-sm bg-amber-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                            @click="saveAll"
                        >
                            {{ saving ? '保存中…' : dirtyCount ? `保存 ${dirtyCount} 项` : '保存' }}
                        </button>
                    </div>
                </div>
            </header>

            <!-- 日历：日期块来源 -->
            <section class="mb-5 border border-stone-200/80 bg-white/90 shadow-sm">
                <div class="flex items-center justify-between border-b border-dashed border-stone-200 px-4 py-2.5">
                    <h2 class="flex items-center gap-2 text-sm font-semibold text-stone-600">
                        <span class="inline-block h-2 w-2 rotate-45 bg-amber-500"></span>
                        日期块
                    </h2>
                    <p class="text-xs text-stone-400">拖到下方排版区，或直接点击加入</p>
                </div>
                <div class="px-4 py-3">
                    <p v-if="overviewError" class="mb-2 text-xs text-red-500">{{ overviewError }}</p>
                    <div class="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] text-stone-400">
                        <span v-for="w in WEEKDAYS" :key="w">周{{ w }}</span>
                    </div>
                    <div class="space-y-1.5">
                        <div v-for="(week, wi) in calendar" :key="wi" class="grid grid-cols-7 gap-1.5">
                            <template v-for="(day, di) in week" :key="di">
                                <span v-if="!day"></span>
                                <button
                                    v-else
                                    type="button"
                                    :draggable="!day.disabled"
                                    class="day-ticket group relative flex h-14 flex-col items-center justify-center gap-0.5 border text-center transition select-none"
                                    :class="[
                                        day.disabled
                                            ? 'cursor-not-allowed border-stone-100 bg-stone-50 text-stone-300'
                                            : day.onBoard
                                                ? 'cursor-grab border-amber-300 bg-amber-50/70 text-amber-800 active:cursor-grabbing'
                                                : day.forbidden
                                                    ? 'cursor-grab border-red-200/70 bg-red-50/40 text-stone-400 hover:border-red-300 active:cursor-grabbing'
                                                    : 'cursor-grab border-stone-200 bg-white text-stone-600 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md active:cursor-grabbing',
                                    ]"
                                    :aria-label="`拖动 ${day.day} 日到排版区`"
                                    @dragstart="onDayDragStart(day, $event)"
                                    @dragend="onDragEnd"
                                    @click="!day.disabled && addColumn(day.offsetDay)"
                                >
                                    <span v-if="day.monthLabel" class="absolute left-1 top-0.5 font-mono text-[8px] uppercase text-stone-300">{{ day.monthLabel }}</span>
                                    <span
                                        class="font-mono text-base leading-none tabular-nums"
                                        :class="day.isToday && !day.disabled ? 'font-bold text-amber-600' : ''"
                                    >{{ day.day }}</span>
                                    <span class="flex items-center gap-1 text-[9px] leading-none">
                                        <template v-if="day.disabled">—</template>
                                        <template v-else>
                                            <span v-if="day.forbidden" class="text-red-400">禁用</span>
                                            <span v-else-if="day.count > 0" class="text-stone-400">{{ day.count }} 首</span>
                                            <span v-else class="text-stone-300">空</span>
                                            <span v-if="day.onBoard" class="inline-block h-1 w-1 rounded-full bg-amber-500"></span>
                                        </template>
                                    </span>
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 排版区 -->
            <section>
                <div class="mb-2 flex items-center justify-between">
                    <h2 class="flex items-center gap-2 text-sm font-semibold text-stone-600">
                        <span class="inline-block h-2 w-2 rotate-45 bg-stone-400"></span>
                        排版区
                    </h2>
                    <p class="hidden text-xs text-stone-400 md:block">
                        歌曲拖到其他列 = 转移到那天 · 拖回本列 = 移到列尾 · 列顶部把手线 = 横向排序 · 改动需点右上角保存
                    </p>
                </div>

                <div
                    class="lay-board min-h-[430px] border p-3 transition-colors"
                    :class="areaOver ? 'border-amber-400 bg-amber-50/50' : 'border-stone-200/80'"
                    @dragover="onAreaDragOver"
                    @dragleave="onAreaDragLeave"
                    @drop="onAreaDrop"
                >
                    <!-- 空状态 -->
                    <div
                        v-if="layoutCols.length === 0"
                        class="flex h-[400px] flex-col items-center justify-center gap-3 text-center"
                    >
                        <svg class="h-10 w-10 text-stone-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" />
                        </svg>
                        <p class="text-sm text-stone-400">从上方日历拖入日期块，生成栏目列</p>
                    </div>

                    <!-- 栏目列（横向） -->
                    <div v-else class="flex items-stretch gap-3 overflow-x-auto pb-2">
                        <template v-for="col in layoutCols" :key="col.offsetDay">
                            <!-- 横向排序插入指示条 -->
                            <div v-if="showHintBefore(col.offsetDay)" class="w-1.5 shrink-0 self-stretch rounded-full bg-amber-400 lay-pulse"></div>

                            <div
                                class="col-card flex w-60 shrink-0 flex-col border border-stone-200/90 bg-white shadow-sm"
                                :class="dragColDay === col.offsetDay && dragKind === 'col' ? 'opacity-40' : ''"
                                @dragover="onColDragOver(col, $event)"
                                @drop="onColDrop(col, $event)"
                            >
                                <!-- 列顶部把手线：拖住横向排序 -->
                                <div
                                    class="col-handle flex h-6 shrink-0 cursor-grab items-center justify-center border-b border-dashed border-stone-200 bg-stone-50/70 transition hover:bg-amber-50 active:cursor-grabbing"
                                    :title="`拖动调整「${dateLabelOf(col.offsetDay)}」列的横向位置`"
                                    :draggable="true"
                                    @dragstart="onColHandleDragStart(col, $event)"
                                    @dragend="onDragEnd"
                                >
                                    <span class="inline-grid grid-cols-3 gap-[3px]">
                                        <i v-for="n in 6" :key="n" class="h-[3px] w-[3px] rounded-full bg-stone-300"></i>
                                    </span>
                                </div>

                                <!-- 列头 -->
                                <div class="flex items-baseline justify-between gap-2 border-b border-stone-100 px-3 py-2">
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-semibold text-stone-700">
                                            {{ dateLabelOf(col.offsetDay) }}
                                            <span class="ml-1 text-xs font-normal text-stone-400">{{ weekdayOf(col.offsetDay) }}</span>
                                            <span v-if="col.offsetDay === 0" class="ml-1 rounded-sm bg-amber-100 px-1 font-mono text-[9px] font-medium text-amber-700">TODAY</span>
                                        </p>
                                        <p class="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-stone-300">
                                            {{ col.entries.length }} SONGS
                                            <span
                                                v-if="colPendingCount(col.offsetDay) > 0"
                                                class="rounded-sm bg-amber-100 px-1 leading-none text-amber-700"
                                            >{{ colPendingCount(col.offsetDay) }} UNSAVED</span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="shrink-0 text-stone-300 transition hover:text-red-500"
                                        :aria-label="`移除 ${dateLabelOf(col.offsetDay)} 列`"
                                        @click="removeColumn(col.offsetDay)"
                                    >
                                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <!-- 歌曲列表 -->
                                <div class="lay-scroll max-h-[320px] min-h-[120px] flex-1 overflow-y-auto">
                                    <p v-if="col.error" class="px-3 py-3 text-xs text-red-500">{{ col.error }}</p>
                                    <p v-else-if="col.loading" class="px-3 py-6 text-center text-xs text-stone-300">加载中…</p>
                                    <p v-else-if="col.entries.length === 0" class="px-3 py-6 text-center text-xs text-stone-300">
                                        这天还没有点播
                                    </p>
                                    <ul v-else class="divide-y divide-stone-50">
                                        <li
                                            v-for="(entry, si) in col.entries"
                                            :key="si"
                                            class="lay-song flex cursor-grab items-center gap-2 px-2.5 py-1.5 transition hover:bg-amber-50/60 active:cursor-grabbing"
                                            :class="dragSong?.day === col.offsetDay && dragSong?.entry === entry ? 'opacity-30' : ''"
                                            :draggable="true"
                                            @dragstart="onSongDragStart(col, entry, $event)"
                                            @dragend="onDragEnd"
                                        >
                                            <span class="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-stone-300">{{ si + 1 }}</span>
                                            <img
                                                v-if="entry.song?.artwork"
                                                :src="entry.song.artwork"
                                                :alt="entry.song.title"
                                                class="h-8 w-8 shrink-0 bg-stone-100 object-cover"
                                                loading="lazy"
                                                draggable="false"
                                            />
                                            <div v-else class="h-8 w-8 shrink-0 bg-stone-100"></div>
                                            <div class="min-w-0 flex-1">
                                                <p class="truncate text-xs font-medium text-stone-700">{{ entry.song?.title }}</p>
                                                <p class="truncate text-[10px] text-stone-400">
                                                    {{ entry.userName }}<span class="text-stone-300"> · {{ entry.className }}</span>
                                                </p>
                                            </div>
                                            <span class="shrink-0 font-mono text-[9px] tabular-nums text-stone-300">{{ formatTime(entry.song?.duration ?? 0) }}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </template>

                        <!-- 末尾插入指示条 -->
                        <div v-if="showHintAfterLast()" class="w-1.5 shrink-0 self-stretch rounded-full bg-amber-400 lay-pulse"></div>
                    </div>
                </div>
            </section>
        </div>

        <!-- 提示条 -->
        <Teleport to="body">
            <Transition name="toast">
                <div
                    v-if="toastMsg"
                    class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 border border-stone-700 bg-stone-800 px-4 py-2 text-sm text-stone-50 shadow-lg"
                >
                    {{ toastMsg }}
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
/* 纸面底 + 点阵排版板 */
.lay-page {
    background-color: #f7f6f2;
    background-image: radial-gradient(circle, rgba(120, 113, 108, 0.13) 1px, transparent 1px);
    background-size: 18px 18px;
}

/* 日期块票券感：右下切角 */
.day-ticket {
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%);
}

/* 排版板内阴影，像一块软木板边槽 */
.lay-board {
    background-color: #fbfaf7;
    box-shadow: inset 0 1px 4px rgba(87, 83, 78, 0.08);
}

/* 列入场动画（横向铺开） */
.col-card {
    animation: col-in 0.34s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes col-in {
    from {
        opacity: 0;
        transform: translateY(14px) scale(0.97);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

/* 插入指示条呼吸 */
.lay-pulse {
    animation: hint-pulse 1s ease-in-out infinite;
}
@keyframes hint-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
}

/* 提示条过渡 */
.toast-enter-active,
.toast-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translate(-50%, 8px);
}
</style>
