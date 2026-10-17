<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import type { ColumnEntry, deleteColumnRowReq } from "../../shared/types/api/order.d.ts";
import type { OverviewDay, CalDay } from "../types/calendar";
import { formatTime } from "../utils/formatTime";
import CalendarGrid from "../components/calendarGrid.vue";

const router = useRouter();

// ===== 预览数据（全部栏目摘要，含禁用状态） =====
const overview = ref<Record<string, OverviewDay>>({});
const overviewError = ref('');

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

// 登录态失效时跳回登录页
function onAuthError(err: unknown): void {
    const code = (err as { code?: number })?.code;
    if (code === 301 || code === 303 || code === 304) {
        localStorage.removeItem('admin');
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
    }
}

// Authorization: Bearer 后备（Cookie 因浏览器限制未携带时仍可鉴权）
function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('adminToken') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// ===== 日历多选：批量禁用/启用 =====
const selectedDays = ref<number[]>([]);
const batchLoading = ref(false);
const batchMsg = ref('');

function toggleDay(day: CalDay): void {
    const idx = selectedDays.value.indexOf(day.offsetDay);
    if (idx >= 0) selectedDays.value.splice(idx, 1);
    else selectedDays.value.push(day.offsetDay);
}

async function batchChange(disabled: boolean): Promise<void> {
    if (batchLoading.value || selectedDays.value.length === 0) return;
    batchLoading.value = true;
    batchMsg.value = '';
    try {
        await xfetch('/api/admin/column/available/v1.0', {
            method: 'POST',
            headers: authHeaders(),
            body: selectedDays.value.map(offsetDay => ({ offsetDay, disabled })),
        });
        batchMsg.value = `已${disabled ? '禁用' : '启用'} ${selectedDays.value.length} 天`;
        selectedDays.value = [];
        await fetchOverview();
    } catch (err) {
        batchMsg.value = getErrorMessage(err);
        onAuthError(err);
    } finally {
        batchLoading.value = false;
    }
}

// ===== 子界面：单日详情（多选歌曲删除 + 单日禁用切换） =====
const activeDay = ref(0);
const showDetail = ref(false);
const entries = ref<ColumnEntry[]>([]);
const loading = ref(false);
const errorMsg = ref('');
const selectedRows = ref<number[]>([]);
const deleteLoading = ref(false);

const activeDateLabel = computed<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + activeDay.value);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
});

// 当天是否被禁用（从索引摘要读取）
const activeDayDisabled = computed<boolean>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + activeDay.value);
    const key = d.toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\//g, '-');
    return overview.value[key]?.disabled === true;
});

async function fetchColumn(offsetDay: number): Promise<void> {
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await xfetch<{ columns: ColumnEntry[]; timestamp: number }>(
            '/api/order/column/lookup/single/v1.0',
            { params: { offsetDay }, headers: authHeaders() }
        );
        entries.value = res?.columns ?? [];
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
        onAuthError(err);
    } finally {
        loading.value = false;
    }
}

function openDay(day: CalDay): void {
    activeDay.value = day.offsetDay;
    showDetail.value = true;
    selectedRows.value = [];
    void fetchColumn(day.offsetDay);
}

function closeDetail(): void {
    showDetail.value = false;
}

function toggleRow(idx: number): void {
    const i = selectedRows.value.indexOf(idx);
    if (i >= 0) selectedRows.value.splice(i, 1);
    else selectedRows.value.push(idx);
}

function isRowSelected(idx: number): boolean {
    return selectedRows.value.includes(idx);
}

// 删除选中的歌曲条目（含跟随用户一并删除）
async function deleteSelected(): Promise<void> {
    if (deleteLoading.value || selectedRows.value.length === 0) return;
    deleteLoading.value = true;
    errorMsg.value = '';
    try {
        const req: deleteColumnRowReq = {
            offsetDay: activeDay.value,
            deleteRows: selectedRows.value
                .map(idx => entries.value[idx])
                .filter(e => !!e?.song)
                .map(e => ({
                    className: e.className,
                    userName: e.userName,
                    userId: e.userId,
                    songItem: { id: e.song.id, platform: e.song.platform },
                })),
        };
        await xfetch('/api/admin/column/row/delete/v1.0', { method: 'POST', headers: authHeaders(), body: req });
        selectedRows.value = [];
        await fetchColumn(activeDay.value);
        await fetchOverview();
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
        onAuthError(err);
    } finally {
        deleteLoading.value = false;
    }
}

// 单日禁用/启用切换
async function toggleDayDisabled(): Promise<void> {
    errorMsg.value = '';
    try {
        await xfetch('/api/admin/column/available/v1.0', {
            method: 'POST',
            headers: authHeaders(),
            body: [{ offsetDay: activeDay.value, disabled: !activeDayDisabled.value }],
        });
        await fetchOverview();
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
        onAuthError(err);
    }
}

// ===== 退出登录 =====
const loggingOut = ref(false);
async function onLogout(): Promise<void> {
    if (loggingOut.value) return;
    loggingOut.value = true;
    try {
        await xfetch('/api/admin/auth/logout', { method: 'POST', headers: authHeaders() });
    } catch {
        // Cookie 清理失败不阻塞退出
    } finally {
        localStorage.removeItem('admin');
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
    }
}

function fmtTimestamp(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
}

onMounted(() => {
    void fetchOverview();
});
</script>

<template>
    <div class="relative flex-1 overflow-hidden bg-stone-50 text-stone-800">
        <div class="relative mx-auto max-w-5xl px-4 pb-10 pt-8">
            <header class="mb-4 flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-semibold tracking-wide text-stone-800">栏目管理</h1>
                    <p class="mt-1 text-sm text-stone-400">勾选日期批量禁用/启用 · 点击日期管理当天歌曲</p>
                </div>
                <button
                    type="button"
                    :disabled="loggingOut"
                    class="rounded-sm border border-stone-200 px-3 py-1.5 text-sm text-stone-500 transition hover:border-red-300 hover:text-red-500"
                    @click="onLogout"
                >
                    退出登录
                </button>
            </header>

            <!-- 批量操作工具条 -->
            <div class="mb-4 flex flex-wrap items-center gap-3 border border-stone-200/70 bg-white px-4 py-3">
                <span class="text-sm text-stone-500">
                    已选 <span class="font-medium text-amber-700">{{ selectedDays.length }}</span> 天
                </span>
                <button
                    type="button"
                    :disabled="selectedDays.length === 0 || batchLoading"
                    class="rounded-sm bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    @click="batchChange(true)"
                >
                    批量禁用
                </button>
                <button
                    type="button"
                    :disabled="selectedDays.length === 0 || batchLoading"
                    class="rounded-sm bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    @click="batchChange(false)"
                >
                    批量启用
                </button>
                <button
                    v-if="selectedDays.length > 0"
                    type="button"
                    class="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
                    @click="selectedDays = []"
                >
                    清除选择
                </button>
                <span v-if="batchMsg" class="text-xs text-stone-400">{{ batchMsg }}</span>
                <span v-if="overviewError" class="text-xs text-red-500">{{ overviewError }}</span>
            </div>

            <CalendarGrid
                :overview="overview"
                selectable
                :selected="selectedDays"
                @dayToggle="toggleDay"
                @dayClick="openDay"
            />
        </div>

        <!-- 子界面：单日歌曲管理浮层 -->
        <Teleport to="body">
            <div
                v-if="showDetail"
                class="fixed inset-0 z-[60] overflow-y-auto bg-stone-900/40"
                @click.self="closeDetail"
            >
                <div class="mx-auto my-16 w-[calc(100%-2rem)] max-w-2xl border border-stone-200/70 bg-white shadow-xl">
                    <header class="flex items-baseline justify-between border-b border-stone-100 px-4 py-3">
                        <h2 class="flex items-center gap-2 text-lg font-semibold text-stone-800">
                            管理栏目
                            <span class="text-sm font-normal text-stone-400">{{ activeDateLabel }}</span>
                            <span
                                class="rounded-full px-2 py-0.5 text-xs font-medium"
                                :class="activeDayDisabled ? 'bg-red-100 text-red-500' : 'bg-emerald-50 text-emerald-600'"
                            >
                                {{ activeDayDisabled ? '已禁用' : '已启用' }}
                            </span>
                        </h2>
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                class="rounded-sm border px-2.5 py-1 text-xs transition"
                                :class="[
                                    activeDayDisabled
                                        ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                        : 'border-red-200 text-red-500 hover:bg-red-50',
                                ]"
                                @click="toggleDayDisabled"
                            >
                                {{ activeDayDisabled ? '启用当天' : '禁用当天' }}
                            </button>
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

                    <!-- 删除工具条 -->
                    <div v-if="entries.length > 0" class="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-2">
                        <span class="text-sm text-stone-500">
                            已选 <span class="font-medium text-red-500">{{ selectedRows.length }}</span> 首
                        </span>
                        <button
                            type="button"
                            :disabled="selectedRows.length === 0 || deleteLoading"
                            class="rounded-sm bg-red-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            @click="deleteSelected"
                        >
                            {{ deleteLoading ? '删除中…' : '删除所选歌曲' }}
                        </button>
                    </div>

                    <ul v-if="entries.length > 0" class="divide-y divide-stone-100">
                        <li
                            v-for="(entry, idx) in entries"
                            :key="idx"
                            class="flex cursor-pointer items-center gap-3 px-4 py-2 transition hover:bg-amber-50/60"
                            :class="{ 'bg-red-50/50': isRowSelected(idx) }"
                            @click="toggleRow(idx)"
                        >
                            <!-- 选择框 -->
                            <button
                                type="button"
                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                                :class="[
                                    isRowSelected(idx)
                                        ? 'border-red-500 bg-red-500 text-white'
                                        : 'border-stone-300 bg-white hover:border-red-400',
                                ]"
                                :aria-label="`选择 ${entry.song?.title}`"
                                @click.stop="toggleRow(idx)"
                            >
                                <svg v-if="isRowSelected(idx)" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </button>

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
                                    {{ entry.song?.artist }}
                                    <span v-if="entry.song?.album"> · {{ entry.song.album }}</span>
                                </p>
                            </div>

                            <span class="hidden w-16 shrink-0 truncate text-right text-xs text-stone-400 sm:block">
                                {{ entry.userName }}
                            </span>
                            <span class="hidden w-20 shrink-0 truncate text-right text-xs text-stone-300 md:block">
                                {{ entry.className }}
                            </span>
                            <span
                                v-if="entry.followUsers?.length"
                                class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600"
                            >
                                {{ entry.followUsers.length }} 人跟随
                            </span>
                            <span class="shrink-0 font-mono text-xs text-stone-300">
                                {{ formatTime(entry.song?.duration ?? 0) }}
                            </span>
                            <span class="w-10 shrink-0 text-right font-mono text-xs text-stone-300">
                                {{ fmtTimestamp(entry.timestamp) }}
                            </span>
                        </li>
                    </ul>

                    <!-- 空状态 -->
                    <div v-else class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                        <p class="text-sm text-stone-400">{{ loading ? '正在加载栏目…' : '这一天还没有点播记录' }}</p>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
