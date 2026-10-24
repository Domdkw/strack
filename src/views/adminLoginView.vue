<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import xfetch from "../utils/xfetch";
import { getErrorMessage } from "../utils/apiError";
import { encryptPassword, signAdminBody, type Admin } from "../utils/adminSecurity";

const router = useRouter();

const name = ref('');
const userId = ref('');
const password = ref('');
const schoolName = ref('');
const secretKey = ref('');
const loading = ref(false);
const errorMsg = ref('');

// localStorage 中的 password 是已加密值：自动填充后直接复用，避免二次加密
const useStoredPassword = ref(false);

// 登录页自动回填上次成功登录的凭证
onMounted((): void => {
    const raw = localStorage.getItem('admin');
    if (!raw) return;
    try {
        const admin: Admin = JSON.parse(raw);
        name.value = admin.name || '';
        userId.value = admin.userId || '';
        password.value = admin.password || '';
        schoolName.value = admin.schoolName || '';
        secretKey.value = admin.secretKey || '';
        useStoredPassword.value = !!admin.password;
    } catch {
        // 本地数据损坏则直接丢弃，避免反复报错
        localStorage.removeItem('admin');
        localStorage.removeItem('adminToken');
    }
});

// 登录失败清除本地凭证，下次需重新完整填写
function clearStored(): void {
    localStorage.removeItem('admin');
    localStorage.removeItem('adminToken');
    useStoredPassword.value = false;
    password.value = '';
}

// 登录路径需与服务端 c.req.path 一致（含 /api 前缀，见 verifyAdminReq 的签名串）
const LOGIN_PATH = '/api/admin/auth/login';

async function onLogin(): Promise<void> {
    if (loading.value) return;
    if (!name.value || !userId.value || !password.value || !schoolName.value || !secretKey.value) {
        errorMsg.value = '请填写全部字段';
        return;
    }
    loading.value = true;
    errorMsg.value = '';
    try {
        // 服务端校验 password === HmacMD5(ADMIN_PASSWORD, ADMIN_SECRET_KEY)，需先本地加密
        const hashedPassword: string = useStoredPassword.value
            ? password.value
            : encryptPassword(password.value, secretKey.value);
        const admin: Admin = {
            name: name.value,
            userId: userId.value,
            password: hashedPassword,
            schoolName: schoolName.value,
            secretKey: secretKey.value,
        };
        // 登录成功（服务端已设置 httpOnly Cookie），本地保存凭证供后续签名使用
        const res = await xfetch<{ token: string }>(LOGIN_PATH, {
            method: 'POST',
            body: signAdminBody(admin, {}, LOGIN_PATH),
        });
        localStorage.setItem('admin', JSON.stringify(admin));
        // Cookie 之外再存一份 token，管理请求用 Authorization: Bearer 后备携带
        localStorage.setItem('adminToken', res?.token ?? '');
        router.push('/admin');
    } catch (err) {
        clearStored();
        errorMsg.value = getErrorMessage(err);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-stone-100 px-4">
        <div class="w-full max-w-sm border border-stone-200/70 bg-white p-6 shadow-sm">
            <header class="mb-5 text-center">
                <h1 class="text-xl font-semibold text-stone-800">广播站管理后台</h1>
                <p class="mt-1 text-xs text-stone-400">管理员登录</p>
            </header>

            <form class="space-y-3" @submit.prevent="onLogin">
                <input
                    v-model="name"
                    type="text"
                    placeholder="管理员名称"
                    autocomplete="username"
                    class="w-full rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400"
                />
                <input
                    v-model="userId"
                    type="text"
                    placeholder="学号"
                    autocomplete="off"
                    class="w-full rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400"
                />
                <input
                    v-model="password"
                    type="password"
                    placeholder="密码"
                    autocomplete="current-password"
                    class="w-full rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400"
                    @input="useStoredPassword = false"
                />
                <input
                    v-model="schoolName"
                    type="text"
                    placeholder="学校名称"
                    autocomplete="off"
                    class="w-full rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400"
                />
                <input
                    v-model="secretKey"
                    type="password"
                    placeholder="密钥 (Secret Key)"
                    autocomplete="off"
                    class="w-full rounded-sm border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400"
                    @input="useStoredPassword = false"
                />

                <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

                <button
                    type="submit"
                    :disabled="loading"
                    class="w-full rounded-sm bg-amber-600 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {{ loading ? '登录中…' : '登录' }}
                </button>
            </form>
        </div>
    </div>
</template>
