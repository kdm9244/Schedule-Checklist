import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import MainView from '../views/MainView.vue'
const TodayView = () => import('../views/TodayView.vue')
const CalendarView = () => import('../views/CalendarView.vue')
const EventCreateView = () => import('../views/EventCreateView.vue')
const SettingsView = () => import('../views/SettingsView.vue')

const routes = [
  {
    path: '/login',
    component: LoginView
  },
  {
    path: '/',
    component: MainView,
    children: [
      {
        path: '',
        redirect: '/today'
      },
      {
        path: 'today',
        component: TodayView
      },
      {
        path: 'calendar',
        component: CalendarView
      },
      {
        path: 'events/new',
        component: EventCreateView
      },
      {
        path: 'settings',
        component: SettingsView
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
