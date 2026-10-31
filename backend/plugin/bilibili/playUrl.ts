import { ofetch } from "ofetch";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63";

export async function getPlayUrl(
    id: string,
    ext?: Record<string, any>,
    _isVip?: boolean,
) {
    let bvid = ext?.bvid as string | undefined;
    let aid = ext?.aid ? String(ext.aid) : undefined;
    if (!bvid && !aid) {
        if (/^BV/i.test(id)) bvid = id;
        else aid = id;
    }
    let cid: string | number | undefined = ext?.cid;
    if (!cid) {
        // playurl 必须依赖 cid，缺失时先取视频信息
        const view = await ofetch<{ code: number; data?: { cid: number } }>(
            "https://api.bilibili.com/x/web-interface/view",
            {
                params: bvid ? { bvid } : { aid },
                headers: {
                    "user-agent": UA,
                    referer: "https://www.bilibili.com/",
                },
            },
        );
        cid = view.data?.cid;
    }
    if (!cid) return { url: undefined };
    const play = await ofetch<{
        code: number;
        data?: {
            dash?: { audio?: { bandwidth: number; baseUrl: string }[] };
            durl?: { url: string }[];
        };
    }>("https://api.bilibili.com/x/player/playurl", {
        params: {
            ...(bvid ? { bvid } : { aid }),
            cid,
            fnval: 16,
            platform: "html5",
        },
        headers: { "user-agent": UA, referer: "https://www.bilibili.com/" },
    });
    let url: string | undefined;
    if (play.data?.dash?.audio?.length) {
        // 音频按码率升序，取标准音质（次低），无则最低
        const audios = [...play.data.dash.audio].sort(
            (a, b) => a.bandwidth - b.bandwidth,
        );
        url = (audios[Math.min(1, audios.length - 1)] ?? audios[0]).baseUrl;
    } else {
        url = play.data?.durl?.[0]?.url;
    }
    if (!url) return { url: undefined };
    return {
        url,
        headers: {
            // B 站音源防盗链，必须携带 referer
            referer: `https://www.bilibili.com/video/${bvid ?? aid}`,
        },
    };
}
