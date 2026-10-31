import { enc } from "crypto-js";
import { ofetch } from "ofetch";
import type { SendOrder } from "../../../shared/types/api/order";
//import { verifyUser } from "../../module/verifyUser";
import { verifySetOffset } from "../../utils/verifyOffset";

export namespace HlzhjyReq {
    type User = {
        userName: string;
        userPwd: string;
        className: string;
    }
    type Captcha = {
        captchaKey: string;
        captchaCode: string;
    }
    export type LoginQuery = Omit<User & Captcha, 'className'>;
    export type Req = SendOrder.OrderItem & User & Captcha;
}

export const hlzhjy = {
    baseUrl: 'https://shilongxk.hlzhjy.com',
    verifyReq: (body: Partial<HlzhjyReq.Req>) => {
        if(!body.offsetDay || !body.captchaKey || !body.captchaCode || !body.userName || !body.userPwd || !body.className){
            return false;
        }
        return verifySetOffset(body.offsetDay as number);
    },
    getUserInfo: async (body: Partial<HlzhjyReq.Req>): Promise<{userId: string, userName: string}> => {
        if(!hlzhjy.verifyReq(body)){
            return {userId: '', userName: ''};
        }
        const res = await hlzhjy.fetchApi({
            userName: body.userName as string,
            userPwd: body.userPwd as string,
            captchaKey: body.captchaKey as string,
            captchaCode: body.captchaCode as string,
        });
        if(res.userid === '' || res.login_name === ''){
            return {userId: '', userName: ''};
        }
        return {
            userId: res.userid,
            userName: res.login_name,
        };
    },
    fetchApi: async (data: HlzhjyReq.LoginQuery): Promise<{userid: string, login_name: string}> => {
        const res = await ofetch(`${hlzhjy.baseUrl}/Api/StuLogin/index.php`, {
            method: 'POST',
            body: {
                "login_name": enc.Base64.stringify(enc.Utf8.parse(data.userName)),
                "login_passwd": enc.Base64.stringify(enc.Utf8.parse(data.userPwd)),
                "idcard": "",
                "login_code": data.captchaCode,
                "key_captcha": Number(data.captchaKey)
            },
        });
        if(res.code !== 1){
            return {userid: '', login_name: ''};
        }
        return {
            userid: res.data.userid,
            login_name: res.data.login_name,
        };
    }
}