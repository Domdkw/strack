// 可选协议头（http://、// 等）
const PROTOCOL_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)/i;
// 主机名截止于路径、查询串或哈希
const HOST_RE = /^[^/?#]*/;

export default function getHost(url: string): string {
    const rest = url.replace(PROTOCOL_RE, '');
    return HOST_RE.exec(rest)?.[0] ?? '';
}
