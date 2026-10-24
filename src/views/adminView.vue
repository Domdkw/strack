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

// ===== 公告栏编辑 =====
// 目前仅支持纯文本，保存时一并提交 textType
const blackboard = ref<{ text: string; textType: 'plain' }>({ text: '', textType: 'plain' });
const blackboardMsg = ref('');
const blackboardLoading = ref(false);
const showBlackboard = ref(false); // 公告设置弹窗

async function fetchBlackboard(): Promise<void> {
    try {
        const res = await xfetch<{ text?: string }>('/api/order/page/blackboard/v1.0', {
            headers: authHeaders(),
        });
        blackboard.value.text = res?.text ?? '';
    } catch (err) {
        blackboardMsg.value = getErrorMessage(err);
        onAuthError(err);
    }
}

async function saveBlackboard(): Promise<void> {
    if (blackboardLoading.value) return;
    blackboardLoading.value = true;
    blackboardMsg.value = '';
    try {
        await xfetch('/api/admin/page/blackboard/v1.0', {
            method: 'POST',
            headers: authHeaders(),
            body: { text: blackboard.value.text, textType: blackboard.value.textType },
        });
        blackboardMsg.value = '公告已保存';
        await fetchBlackboard();
    } catch (err) {
        blackboardMsg.value = getErrorMessage(err);
        onAuthError(err);
    } finally {
        blackboardLoading.value = false;
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
    void fetchBlackboard();
});
</script>

<template>
    <div class="relative flex-1 bg-stone-50 text-stone-800">
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

            <!-- 公告栏设置入口：点击打开设置弹窗 -->
            <button
                type="button"
                class="mb-4 flex w-full items-center justify-between gap-3 border border-amber-200/70 bg-white px-4 py-2.5 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
                @click="showBlackboard = true"
            >
                <span class="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.148-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                    </span>
                    公告栏设置
                </span>
                <span class="flex items-center gap-2 text-xs">
                    <span
                        class="rounded-full px-2 py-0.5 font-medium"
                        :class="blackboard.text.trim() ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-400'"
                    >
                        {{ blackboard.text.trim() ? '公告展示中' : '公告已关闭' }}
                    </span>
                    <span class="text-stone-300">编辑</span>
                    <svg class="h-3.5 w-3.5 text-stone-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </span>
            </button>

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

        <!-- 公告栏设置弹窗 -->
        <Teleport to="body">
            <Transition name="bb">
                <div
                    v-if="showBlackboard"
                    class="fixed inset-0 z-[65] flex justify-center bg-stone-900/40 px-4 pt-24"
                    @click.self="showBlackboard = false"
                >
                    <div class="bb-panel h-fit w-full max-w-lg border-t-2 border-amber-400 bg-white shadow-xl">
                        <header class="flex items-center justify-between border-b border-stone-100 px-5 py-3">
                            <h2 class="flex items-center gap-2 text-sm font-semibold text-stone-700">
                                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.148-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                </span>
                                公告栏设置
                            </h2>
                            <button
                                type="button"
                                class="text-stone-400 transition hover:text-stone-700"
                                aria-label="关闭"
                                @click="showBlackboard = false"
                            >
                                <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </header>

                        <div class="px-5 py-4">
                            <p class="text-xs text-stone-400">纯文本 · 最多 200 字 · 留空保存则关闭公告</p>
                            <textarea
                                v-model="blackboard.text"
                                rows="5"
                                maxlength="200"
                                placeholder="输入公告内容，用户首次访问时会自动弹出"
                                class="mt-2 w-full resize-y rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-amber-300"
                            ></textarea>
                            <div class="mt-1 text-right text-xs text-stone-300">{{ blackboard.text.length }}/200</div>
                        </div>

                        <footer class="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/60 px-5 py-3">
                            <span class="text-xs text-stone-400">{{ blackboardMsg }}</span>
                            <span class="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    class="px-2 py-1.5 text-sm text-stone-400 transition hover:text-stone-600"
                                    @click="showBlackboard = false"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    :disabled="blackboardLoading"
                                    class="rounded-sm bg-amber-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    @click="saveBlackboard"
                                >
                                    {{ blackboardLoading ? '保存中…' : '保存公告' }}
                                </button>
                            </span>
                        </footer>
                    </div>
                </div>
            </Transition>
        </Teleport>

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

<style scoped>
.bb-enter-active,
.bb-leave-active {
    transition: opacity 0.22s ease;
}

.bb-enter-from,
.bb-leave-to {
    opacity: 0;
}

.bb-enter-active .bb-panel {
    animation: bb-drop 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.bb-leave-active .bb-panel {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.bb-leave-to .bb-panel {
    opacity: 0;
    transform: translateY(-12px);
}

@keyframes bb-drop {
    from {
        opacity: 0;
        transform: translateY(-26px) scale(0.98);
    }
    to {
        opacity: 1;
        transform: none;
    }
}
</style>
