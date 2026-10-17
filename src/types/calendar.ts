// 日历公共类型：calendarGrid 组件与各视图（orderView / adminView）共用

// 预览接口返回的单日摘要（后端 ColumnIndex AllColumnDay）
export type OverviewSong = { artwork?: string; title: string; followCount: number };
export type OverviewDay = {
    songs: OverviewSong[];
    timestamp: number;
    disabled?: boolean; // 该日栏目被管理员禁用
};

// 日历单元格：null 表示占位空白
export type CalDay = {
    offsetDay: number;   // 距今天的天数（0=今天，负数=过去）
    day: number;         // 几号
    isToday: boolean;
    disabled: boolean;   // 不可操作（过去或超出最大范围）
    songs: OverviewSong[];
};
export type CalWeek = { start: Date; end: Date; days: (CalDay | null)[] };
