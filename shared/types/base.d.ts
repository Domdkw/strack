export type Platform = 'migu' | 'ncm';

export type ApiData<T> = {
    code: number;
    error?: string;
    data?: T;
}