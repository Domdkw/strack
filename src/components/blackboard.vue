<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import xfetch from "../utils/xfetch";
import BlackboardContent from "./blackboardContent.vue";

// 「不再显示」写入本地存储后，后续访问不再自动弹出（导航栏按钮仍保留，可手动打开）
const HIDE_KEY = "blackboardHide";

// 前端只关心 text，忽略后端的内容类型
const content = ref<{ text: string } | null>(null);
const open = ref(false);
// 是否已选择「不再显示」：隐藏时不在加载阶段请求接口，点击按钮时才拉取内容
const hidden = ref<boolean>(!!localStorage.getItem(HIDE_KEY));

// 无公告内容时不渲染按钮（隐藏状态下按钮常驻，供手动拉取）
const hasContent = computed<boolean>(() => !!content.value?.text.trim());
const showButton = computed<boolean>(() => hasContent.value || hidden.value);

async function loadContent(): Promise<void> {
    const res = await xfetch<{ text?: string }>("/api/order/page/blackboard/v1.0");
    content.value = { text: res?.text ?? '' };
}

// 点击导航栏按钮：隐藏状态下首次点击时才拉取内容，已有内容则直接打开
async function openBoard(): Promise<void> {
    if (!hasContent.value) {
        try {
            await loadContent();
        } catch {
            // 公告拉取失败不打开弹窗
            return;
        }
    }
    if (hasContent.value) open.value = true;
}

function hideForever(): void {
    localStorage.setItem(HIDE_KEY, "1");
    hidden.value = true;
    open.value = false;
}

onMounted(async () => {
    // 已选择「不再显示」：不在加载阶段请求接口
    if (hidden.value) return;
    try {
        await loadContent();
        if (hasContent.value) open.value = true;
    } catch {
        // 公告拉取失败不阻塞页面
    }
});
</script>

<template>
    <!-- 导航栏公告按钮：有内容或已选择「不再显示」时显示 -->
    <button
        v-if="showButton"
        type="button"
        class="flex items-center gap-1.5 px-6 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-amber-50 hover:text-amber-700"
        @click="openBoard"
    >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.148-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        公告
    </button>

    <!-- 公告弹窗：从页面上方落下 -->
    <Teleport to="body">
        <Transition name="board">
            <div
                v-if="open && hasContent"
                class="fixed inset-0 z-[70] flex justify-center bg-stone-900/40 px-4 pt-16 backdrop-blur-sm backdrop-grayscale"
                @click.self="open = false"
            >
                <div
                    class="board-panel h-fit w-full max-w-3xl border-t-4 border-amber-400 bg-white shadow-[0_28px_70px_-24px_rgba(120,83,20,0.55)]"
                    role="dialog"
                    aria-modal="true"
                    aria-label="公告栏"
                >
                    <header class="flex items-center justify-between border-b border-stone-100 px-8 py-5">
                        <h2 class="flex items-center gap-3 text-base font-semibold tracking-wide text-stone-800">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.148-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </span>
                            公告栏
                        </h2>
                        <button
                            type="button"
                            class="text-stone-400 transition hover:text-stone-700"
                            aria-label="关闭公告"
                            @click="open = false"
                        >
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </header>

                    <div class="max-h-[70vh] min-h-[16rem] overflow-y-auto px-8 py-6">
                        <BlackboardContent :text="content?.text ?? ''" />
                    </div>

                    <footer class="flex items-center justify-end gap-3 border-t border-stone-100 bg-stone-50/60 px-8 py-4">
                        <button
                            type="button"
                            class="px-3 py-2 text-sm text-stone-400 transition hover:text-stone-600"
                            @click="hideForever"
                        >
                            不再显示
                        </button>
                        <button
                            type="button"
                            class="bg-amber-500 px-6 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
                            @click="open = false"
                        >
                            知道了
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.board-enter-active,
.board-leave-active {
    transition: opacity 0.22s ease;
}

.board-enter-from,
.board-leave-to {
    opacity: 0;
}

.board-enter-active .board-panel {
    animation: board-drop 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}

.board-leave-active .board-panel {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.board-leave-to .board-panel {
    opacity: 0;
    transform: translateY(-12px);
}

@keyframes board-drop {
    from {
        opacity: 0;
        transform: translateY(-28px) scale(0.98);
    }
    to {
        opacity: 1;
        transform: none;
    }
}
</style>
