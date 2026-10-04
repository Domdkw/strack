/** 后端业务错误（code !== 0）对应的前端异常，携带中文提示 */
export class ApiError extends Error {
    readonly code: number;
    constructor(code: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
    }
}

/** 后端错误码 → 中文提示 */
const errorMessages: Record<number, string> = {
    202: '日期参数无效（仅支持明天起 21 天内）',
    203: '存储服务异常，请稍后重试',
    205: '栏目数据解析失败',
    206: '缺少歌曲信息',
    207: '班级、姓名或学号格式不正确',
    208: '请求参数不完整',
    209: '点歌提交失败，请稍后重试',
    210: '不支持的音乐平台',
    211: '当日点歌数量已满（最多 10 条）',
};

/** 将后端 code/error 翻译为中文提示 */
export function translateApiError(code: number, error?: string): string {
    return errorMessages[code] ?? (error ? `请求失败：${error}` : '请求失败，请稍后重试');
}

/** 从 unknown 类型错误中提取可展示的中文信息 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return `请求失败：${err.message}`;
    return '请求失败，请稍后重试';
}
