export function verifyName(name: string) {
    if(!name){
        return false;
    }
    const len = name.length;
    if(len < 2 || len > 10){
        return false;
    }
    for(let i=0; i<len; i++){
        const c = name[i];
        if(!/^[\u4e00-\u9fa5]/.test(c)){
            return false;
        }
    }
    return true;
}
export function verifyUserId(userid: string) {
    if(!userid){
        return false;
    }
    if(userid.length !== 13 && userid.length !== 10){
        return false;
    }
    return true;
}
export function verifyClassName(className: string) {
    if(!className || className.length !== 3){
        return false;
    }
    const c = className.slice(1, 3), d = className[0];// 0xx
    if(!['3', '1', '2'].includes(d)){
        return false;
    }
    if(Number(c) < 0 || Number(c) > 30){
        return false;
    }
    return true;
}

export function verifyAll(name: string, userid: string, className: string) {
    return verifyName(name) && verifyUserId(userid) && verifyClassName(className);
}