import { createRouter, createWebHistory } from 'vue-router'
import SearchView from '../views/searchView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/search',
            name: 'search',
            component: SearchView,
        },
    ],
})

export default router
