import type { Storage } from "unstorage";
import type { AllColumnDay, ReturnAllColumn } from "../module/columns/ColumnIndex";
import { ColumnIndex } from "../module/columns/ColumnIndex";

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/** 转义文本，避免歌曲名 / 用户名中的特殊字符破坏 HTML 结构 */
function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch);
}

/** 取出按日期分组的有效栏目数据，并按日期升序排列 */
function getDays(columns: ReturnAllColumn): [string, AllColumnDay][] {
    return Object.entries(columns)
        .filter(([, day]) => typeof day === 'object' && day !== null && Array.isArray(day.songs))
        .sort(([a], [b]) => a.localeCompare(b)) as [string, AllColumnDay][];
}

/** 日期作为最左侧一列，`rowspan` 合并同一天的行，不单独分隔 */
function renderRows(date: string, day: AllColumnDay): string {
    if (day.songs.length === 0) {
        return `
                    <tr>
                        <td class="empty date">${escapeHtml(date)}</td>
                        <td colspan="3" class="empty">暂无点歌</td>
                    </tr>`;
    }
    return day.songs.map((song, index) => `
                    <tr>
                        ${index === 0 ? `<td class="date" rowspan="${day.songs.length}">${escapeHtml(date)}</td>` : ''}
                        <td class="title">${escapeHtml(song.title)}</td>
                        <td>${escapeHtml(song.userName)}</td>
                        <td>${escapeHtml(song.className)}</td>
                    </tr>`).join('');
}

/**
 * 将 ColumnIndex 的索引数据渲染为按日期分类的 HTML 表格页面
 * @param columns ColumnIndex.getAllColumn() 返回的数据
 */
export function renderColumnTable(columns: ReturnAllColumn): string {
    const days = getDays(columns);
    const content = days.length
        ? `<table>
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>歌名</th>
                        <th>用户名</th>
                        <th>班级</th>
                    </tr>
                </thead>
                <tbody>${days.map(([date, day]) => renderRows(date, day)).join('')}
                </tbody>
            </table>`
        : '<p class="empty">暂无栏目数据</p>';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>点歌栏目</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            color: #1f2328;
            background: #f6f8fa;
        }
        table {
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            border-collapse: collapse;
            font-size: 14px;
            background: #fff;
        }
        th, td {
            padding: 10px 16px;
            text-align: left;
            border-bottom: 1px solid #eaeef2;
        }
        th {
            font-weight: 600;
            color: #59636e;
            background: #fbfcfd;
        }
        /* 日期紧贴歌曲列表，不做额外分隔 */
        td.date {
            white-space: nowrap;
            vertical-align: middle;
            font-weight: 600;
            color: #59636e;
            border-right: none;
        }
        tbody tr:last-child td { border-bottom: none; }
        td.title { font-weight: 500; }
        td.empty, p.empty {
            text-align: left;
            color: #a2acb8;
        }
        p.empty { padding: 48px 0; }
    </style>
</head>
<body>${content}
</body>
</html>`;
}

/** 从 storage 读取栏目索引并渲染为 HTML 表格页面 */
export async function renderTable(storage: Storage): Promise<string> {
    const columns = await new ColumnIndex(storage).getAllColumn();
    return renderColumnTable(columns);
}
