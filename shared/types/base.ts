export const platforms = ['migu', 'ncm', 'kugou', 'kuwo', 'bilibili'] as const;
export type Platform = (typeof platforms)[number];

export type ApiData<T> = {
    code: number;
    error?: string;
    data?: T;
}
