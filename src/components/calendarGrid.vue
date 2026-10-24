<script setup lang="ts">
import { computed, type PropType } from "vue";
import type { OverviewDay, CalDay, CalWeek } from "../types/calendar";

// 公共日历组件：
// - 普通模式（selectable=false）：点击日期 emit dayClick
// - 多选模式（selectable=true）：checkbox 切换选中 emit dayToggle，点击日期主体仍 emit dayClick
const props = defineProps({
    overview: { type: Object as PropType<Record<string, OverviewDay>>, required: true },
    maxOffset: { type: Number, default: 21 },
    selectable: { type: Boolean, default: false },
    selected: { type: Array as PropType<number[]>, default: () => [] },
});
const emit = defineEmits<{
    (e: 'dayClick', day: CalDay): void;
    (e: 'dayToggle', day: CalDay): void;
}>();

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

// 日历按周分行：从本周周日铺到 今天+maxOffset 所在周的周六，过去的星期照常显示（置灰）
const calendar = computed<CalWeek[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(today);
    last.setDate(last.getDate() + props.maxOffset);

    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay()); // 本周周日
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - last.getDay())); // 末周周六

    const weeks: CalWeek[] = [];
    let days: (CalDay | null)[] = [];
    let weekStart = new Date(start);

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const offsetDay = Math.round((d.getTime() - today.getTime()) / 86400000);
        const key = dateKey(d);
        days.push({
            offsetDay,
            day: d.getDate(),
            isToday: offsetDay === 0,
            disabled: offsetDay < 0 || offsetDay > props.maxOffset,
            songs: props.overview[key]?.songs ?? [],
        });
        if (days.length === 7) {
            weeks.push({ start: weekStart, end: new Date(d), days });
            days = [];
            weekStart = new Date(d);
            weekStart.setDate(weekStart.getDate() + 1);
        }
    }
    return weeks;
});

// 周行的范围标签，如 10.11 - 10.17
function weekLabel(w: CalWeek): string {
    const fmt = (d: Date): string => `${d.getMonth() + 1}.${d.getDate()}`;
    return `${fmt(w.start)} - ${fmt(w.end)}`;
}

// 该日栏目是否被管理员禁用
function dayDisabled(day: CalDay): boolean {
    return props.overview[dateKeyOfDay(day)]?.disabled === true;
}
function dateKeyOfDay(day: CalDay): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + day.offsetDay);
    return dateKey(d);
}

function isSelected(day: CalDay): boolean {
    return props.selected.includes(day.offsetDay);
}

function onCellClick(day: CalDay): void {
    if (day.disabled) return;
    emit('dayClick', day);
}
function onToggle(day: CalDay): void {
    if (day.disabled) return;
    emit('dayToggle', day);
}
</script>

<template>
    <div>
        <div class="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400">
            <span v-for="w in weekdays" :key="w">{{ w }}</span>
        </div>
        <div class="space-y-3">
            <div v-for="(week, wi) in calendar" :key="wi">
                <p class="mb-1 px-1 text-[10px] text-stone-400">{{ weekLabel(week) }}</p>
                <div class="grid grid-cols-7 gap-1">
                    <template v-for="(day, di) in week.days" :key="di">
                        <span v-if="!day"></span>
                        <div
                            v-else
                            class="relative flex aspect-square w-full flex-col items-center justify-center rounded-lg p-1 text-left transition ring-1 sm:aspect-auto sm:h-24 sm:items-start sm:justify-start sm:rounded-sm sm:p-1.5"
                            :class="[
                                day.disabled
                                    ? 'cursor-not-allowed bg-stone-100/50 text-stone-300 ring-stone-200/80'
                                    : isSelected(day)
                                        ? 'cursor-pointer bg-amber-50 ring-2 ring-amber-500'
                                        : dayDisabled(day)
                                            ? 'cursor-pointer bg-white ring-1 ring-red-200/70 hover:ring-red-400'
                                            : 'cursor-pointer bg-white ring-stone-200/80 hover:ring-amber-400',
                            ]"
                            @click="onCellClick(day)"
                        >
                            <!-- 多选模式的 checkbox -->
                            <button
                                v-if="selectable && !day.disabled"
                                type="button"
                                class="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded border transition"
                                :class="[
                                    isSelected(day)
                                        ? 'border-amber-600 bg-amber-600 text-white'
                                        : 'border-stone-300 bg-white hover:border-amber-500',
                                ]"
                                :aria-label="`选择 ${day.day} 日`"
                                @click.stop="onToggle(day)"
                            >
                                <svg v-if="isSelected(day)" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </button>

                            <!-- 管理员禁用标记（桌面端展示，移动端方块空间有限） -->
                            <span
                                v-if="dayDisabled(day)"
                                class="absolute bottom-1 right-1 hidden rounded-sm bg-red-100 px-1 text-[9px] font-medium leading-none text-red-500 sm:inline"
                            >
                                已禁用
                            </span>

                            <!-- 移动端：日期数字垂直居中固定，今天为实心圆；有栏目时底部小圆点绝对定位不占高度 -->
                            <div class="sm:hidden">
                                <span class="absolute inset-0 flex items-center justify-center">
                                    <span
                                        class="flex h-7 w-7 items-center justify-center rounded-full text-sm leading-none"
                                        :class="day.disabled
                                            ? 'text-stone-300'
                                            : day.isToday
                                                ? 'bg-amber-600 font-semibold text-white'
                                                : 'font-medium text-stone-600'"
                                    >
                                        {{ day.day }}
                                    </span>
                                </span>
                                <span
                                    v-if="day.songs.length > 0"
                                    class="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                                    :class="day.disabled ? 'bg-stone-300' : 'bg-amber-500'"
                                ></span>
                            </div>

                            <!-- 桌面端：日期数字 + 歌曲封面 -->
                            <div class="hidden w-full flex-col items-start sm:flex">
                                <span
                                    class="text-[11px] font-medium leading-none"
                                    :class="[day.isToday ? 'text-amber-700' : 'text-stone-500']"
                                >
                                    {{ day.day }}
                                    <span v-if="day.isToday" class="ml-0.5 text-[9px]">今天</span>
                                </span>

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
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>
