import { createRouter, createWebHashHistory } from 'vue-router'
import OrderView from '../views/orderView.vue'
import RequestOrderView from '../views/requestOrderView.vue'
import SearchView from '../views/searchView.vue'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'order',
            component: OrderView,
        },
        {
            path: '/order/new',
            name: 'orderNew',
            component: RequestOrderView,
        },
        {
            path: '/search',
            name: 'search',
            component: SearchView,
        },
        {
            // 管理员登录页
            path: '/admin/login',
            name: 'adminLogin',
            component: () => import('../views/adminLoginView.vue'),
        },
        {
            // 管理员页：本地凭证守卫（真正的鉴权由服务端 JWT Cookie 校验）
            path: '/admin',
            name: 'admin',
            component: () => import('../views/adminView.vue'),
            beforeEnter: (_to, _from, next) => {
                if (!localStorage.getItem('admin')) next({ name: 'adminLogin' });
                else next();
            },
        },
    ],
})

export default router
