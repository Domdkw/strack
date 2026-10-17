import type { Storage } from "unstorage";
import type { ColumnEntry, deleteColumnRowReq } from "../../../shared/types/api/order";
import {
    type ColumnObj, type ColumnResult,
    getOffsetIndex,
} from "./common";
import ColumnGet from "./ColumnGet";
import ColumnSet from "./ColumnSet";

function removeDeleteItems(deleteRows: deleteColumnRowReq["deleteRows"], columnList: ColumnObj['columns']): ColumnEntry[] {
    const deleteKeySet = new Set(
        deleteRows.map(
            (item) => `${item.songItem.id}|${item.userId}|${item.userName}|${item.className}`,
        ),
    );
    const newColumns = columnList.filter(
        (item) =>
            !deleteKeySet.has(
                `${item.song.id}|${item.userId}|${item.userName}|${item.className}`,
            ),
    );
    return newColumns;
}

class ColumnDel {
    private storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }
    private hasDeleteObjKey(req: deleteColumnRowReq): boolean {
        let hasKey = false;
        if ('deleteRows' in req && req.deleteRows.length > 0 && 'offsetDay' in req)
            hasKey = true;
        return hasKey;
    }
    public async deleteColumnRow(req: deleteColumnRowReq) { try {
        if (!this.hasDeleteObjKey(req)) return { code: 310, error: 'deleteRows or offsetDay is empty' };
        const { deleteRows, offsetDay } = req;
        const columnId = getOffsetIndex(offsetDay);
        const columnResult: ColumnResult = await new ColumnGet(this.storage).getDateColumn(columnId, offsetDay);
        if (!('data' in columnResult)) return columnResult;

        const newColumn: ColumnObj = columnResult.data;
        newColumn.columns = removeDeleteItems(deleteRows, newColumn.columns);
        // 更新栏目
        const updatedColumn = await new ColumnSet(this.storage).setColumnObj(columnId, newColumn);
        return { data: updatedColumn };
    }catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { code: 311, error: errorMessage };
    }}
}

export default ColumnDel;
