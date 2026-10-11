export function randomStr(len: number, type: number = 0): string[] {
    const k: string = type === 0 ? '0123456789abcdef' : '0123456789';
    const str: string[] = [];
    for (let i = 0; i < len; i++) {
        str.push(
            k[Math.floor(
                Math.random() * k.length
            )]
        );
    }
    return str;
}

export function genUUID(): string {
    const s = randomStr(36, 0);
    s[8] = '-', s[13] = '-', s[18] = '-', s[23] = '-';
    return s.join('');
}

export function genSalt(): string {
    return randomStr(6, 1).join('');
}

export interface XhrAccessContext {
    request: Request | string;
    options: { query?: Record<string, unknown> };
}
