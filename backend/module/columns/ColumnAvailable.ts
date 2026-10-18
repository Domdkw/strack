import type { Storage } from "unstorage";
import {
    type ColumnObj, type ColumnResult,
    getOffsetIndex, MAX_COLUMN
} from "./common";
import ColumnGet from "./ColumnGet";
import ColumnSet from "./ColumnSet";

class ColumnAvailable {
    storage: Storage;
    constructor(storage: Storage) {
        this.storage = storage;
    }
    private hasDeleteObjKey(req: {offsetDay: number, disabled: boolean}){
        if(!Number.isInteger(req.offsetDay) || req.offsetDay < 1 || req.offsetDay > MAX_COLUMN-1){
            return false;
        }
        return req.offsetDay !== undefined && req.disabled !== undefined;
    }
    public async changeUseable(req: {offsetDay: number, disabled: boolean}[]){ try{
        const data: Record<string, {disabled: boolean}> = {};
        const columnGet = new ColumnGet(this.storage);
        const columnSet = new ColumnSet(this.storage);
        for (const item of req) {
            if(!this.hasDeleteObjKey(item)){
                return {code: 312,error: "offsetDay and disabled are required"};
            }
            const {offsetDay, disabled} = item;
            const columnId = getOffsetIndex(offsetDay);
            const columnResult: ColumnResult = await columnGet.getDateColumn(columnId, offsetDay);
            if (!('data' in columnResult)) return columnResult;

            const columnObj: ColumnObj = columnResult.data;
            columnObj.disabled = disabled === true;

            const status = (await columnSet.setColumnObj(columnId, columnObj)).disabled;
            data['offsetDay_'+offsetDay] = {disabled: status};
        }
        return { data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {code: 313,error: errorMessage};
    }}
}

export default ColumnAvailable;