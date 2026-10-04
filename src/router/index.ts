import { createRouter, createWebHistory } from 'vue-router'
import OrderView from '../views/orderView.vue'
import RequestOrderView from '../views/requestOrderView.vue'
import SearchView from '../views/searchView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
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
    ],
})

export default router
