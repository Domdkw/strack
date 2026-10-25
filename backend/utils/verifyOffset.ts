import { MAX_COLUMN } from "../module/columns/common";

function _verifyOffset(offsetDay: number, min: number = 0): boolean {
    return Number.isInteger(offsetDay) && offsetDay >= min && offsetDay <= MAX_COLUMN - 1;
}
function verifySetOffset(offsetDay: number): boolean {
    return _verifyOffset(offsetDay, 1);
}
function verifyGetOffset(offsetDay: number): boolean {
    return _verifyOffset(offsetDay, 0);
}

export { verifySetOffset, verifyGetOffset, _verifyOffset };
