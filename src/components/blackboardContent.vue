<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ text: string }>();

// 纯文本解析：统一换行符并去掉首尾空白，保留正文中的换行与缩进
const parsed = computed<string>(() => props.text.replace(/\r\n?/g, "\n").trim());
</script>

<template>
    <p class="whitespace-pre-wrap break-words text-base leading-7 text-stone-700">{{ parsed }}</p>
</template>
