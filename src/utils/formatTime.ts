export function formatTime(s: number) {
    const hour = Math.floor(s / 3600).toString().padStart(2, '0')
    const min = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    let time: string = min + ':' + sec;
    if (hour !== '00') {
        time = hour + ':' + time;
    }
    return time
}
