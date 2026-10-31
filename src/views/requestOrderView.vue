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

const offsetDay = ref<number>(initialOffsetDay()); // 默认明天（最早可点日期），若带入口参数则使用它

// 从搜索页带过来的目标日期（仅接受 1..MAX_OFFSET 内的整数）
function initialOffsetDay(): number {
    const raw = Number(route.query.offsetDay);
    return Number.isInteger(raw) && raw >= 1 && raw <= MAX_OFFSET ? raw : 1;
}
const className = ref('');
const userName = ref('');
const userId = ref('');
const text = ref(''); // 留言（可选，最长 50 字）
const MAX_TEXT = 50;
const submitting = ref(false);
const errorMsg = ref('');

// 验证码弹窗状态：key 用于生成验证码图片，登录时随 captchaKey 一起提交
const CAPTCHA_BASE_URL = 'https://shilongxk.hlzhjy.com/Api/Login/index.php';
const showCaptcha = ref(false);
const captchaKey = ref('');
const captchaCode = ref('');
const captchaImgUrl = computed<string>(() => `${CAPTCHA_BASE_URL}?key=${captchaKey.value}`);

function refreshCaptcha(): void {
    // 随机生成数字 key，与图片地址中的 key 保持一致
    captchaKey.value = String(Math.floor(100000 + Math.random() * 900000));
    captchaCode.value = '';
}

function openCaptcha(): void {
    errorMsg.value = '';
    refreshCaptcha();
    showCaptcha.value = true;
}

function closeCaptcha(): void {
    if (submitting.value) return;
    showCaptcha.value = false;
}

// 表单校验通过后，先弹出验证码窗口
function onSubmit(): void {
    if (submitting.value) return;
    if (!song.value) {
        errorMsg.value = '当前没有选择歌曲，请先播放或搜索一首';
        return;
    }
    if (!className.value.trim() || !userName.value.trim() || !userId.value.trim()) {
        errorMsg.value = '请完整填写班级、姓名、学号';
        return;
    }
    if (text.value.length > MAX_TEXT) {
        errorMsg.value = `留言最长 ${MAX_TEXT} 字`;
        return;
    }
    openCaptcha();
}

// 填写验证码后提交
async function submitOrder(): Promise<void> {
    if (submitting.value) return;
    if (!song.value) {
        errorMsg.value = '当前没有选择歌曲，请先播放或搜索一首';
        return;
    }
    if (!captchaCode.value.trim()) {
        errorMsg.value = '请输入验证码';
        return;
    }
    submitting.value = true;
    errorMsg.value = '';
    try {
        await xfetch<{ className: string }>('/api/order/column/modify/push/hlzhjy', {
            method: 'POST',
            body: {
                className: className.value.trim(),
                userName: userName.value.trim(),
                userId: userId.value.trim(),
                userPwd: userId.value.trim(), // 学号作为校园账号密码
                offsetDay: offsetDay.value,
                captchaKey: captchaKey.value,
                captchaCode: captchaCode.value.trim(),
                ...(text.value.trim() ? { text: text.value.trim() } : {}),
                songItem: {
                    id: song.value.id,
                    platform: song.value.platform,
                },
            },
        });
        void router.push('/');
    } catch (err) {
        errorMsg.value = getErrorMessage(err);
        // 验证码已被消耗，刷新以便重试
        refreshCaptcha();
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="flex-1 bg-[#faf7f0] text-stone-800">
        <div class="mx-auto max-w-xl px-4 pb-10 pt-8">

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

                <label class="mt-5 block">
                    <span class="mb-1.5 flex items-baseline justify-between text-xs font-medium text-stone-500">
                        <span>留言（可选）</span>
                        <span class="font-normal text-stone-300">{{ text.length }}/{{ MAX_TEXT }}</span>
                    </span>
                    <textarea
                        v-model="text"
                        rows="2"
                        maxlength="50"
                        placeholder="给点歌加一句话吧"
                        class="w-full resize-none border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder-stone-300 outline-none transition focus:border-amber-300"
                    ></textarea>
                </label>

                <p v-if="errorMsg && !showCaptcha" class="mt-4 text-sm text-red-500">{{ errorMsg }}</p>

                <button
                    type="submit"
                    :disabled="submitting"
                    class="mt-6 w-full border border-amber-200 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
                >
                    {{ submitting ? '提交中…' : '提交点歌' }}
                </button>
            </form>

            <!-- 验证码弹窗：所有信息填写完成后弹出，通过校园账号验证码核验身份 -->
            <div
                v-if="showCaptcha"
                class="fixed inset-0 z-[70] bg-stone-900/40 px-4"
                @click.self="closeCaptcha"
            >
                <div class="mx-auto mt-24 w-full max-w-sm border border-stone-200/70 bg-white p-6">
                    <header class="mb-5 text-center">
                        <h2 class="text-lg font-semibold text-stone-800">身份验证</h2>
                        <p class="mt-1 text-xs text-stone-400">输入校园账号验证码后完成点歌</p>
                    </header>

                    <form @submit.prevent="submitOrder">
                        <div class="flex items-center gap-3">
                            <input
                                v-model="captchaCode"
                                type="text"
                                inputmode="text"
                                autocomplete="off"
                                maxlength="6"
                                placeholder="请输入验证码"
                                class="min-w-0 flex-1 border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder-stone-300 outline-none transition focus:border-amber-300"
                            />
                            <img
                                :src="captchaImgUrl"
                                alt="验证码"
                                title="点击刷新验证码"
                                class="h-[30px] w-[100px] shrink-0 cursor-pointer border border-stone-200 bg-white object-cover"
                                @click="refreshCaptcha"
                            />
                        </div>
                        <button
                            type="button"
                            class="mt-2 text-xs text-amber-700 underline underline-offset-2"
                            @click="refreshCaptcha"
                        >
                            看不清？换一张
                        </button>

                        <p v-if="errorMsg" class="mt-4 text-sm text-red-500">{{ errorMsg }}</p>

                        <div class="mt-6 flex gap-3">
                            <button
                                type="button"
                                :disabled="submitting"
                                class="flex-1 border border-stone-200 px-4 py-2.5 text-sm text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
                                @click="closeCaptcha"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                :disabled="submitting || !captchaCode.trim()"
                                class="flex-1 border border-amber-200 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
                            >
                                {{ submitting ? '验证中…' : '确认提交' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    </div>
</template>
