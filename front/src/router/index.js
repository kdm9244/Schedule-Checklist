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
      },
      { path: 'learning/roadmaps', component: () => import('../views/RoadmapListView.vue') },
      { path: 'words', component: () => import('../views/WordLibraryView.vue') },
      { path: 'learning/pdf-notes', component: () => import('../views/PdfNotesView.vue') },
      { path: 'learning/pdf-notes/new', component: () => import('../views/PdfNoteView.vue') },
      { path: 'learning/pdf-notes/:id/edit', component: () => import('../views/PdfNoteEditView.vue') },
      { path: 'learning/pdf-notes/:id', component: () => import('../views/PdfNoteView.vue') },
      { path: 'learning/roadmaps/new', component: () => import('../views/LearningEntityView.vue'), meta: { entity:'roadmaps' } },
      { path: 'learning/roadmaps/:id/edit', component: () => import('../views/LearningEntityView.vue'), meta: { entity:'roadmaps' } },
      { path: 'learning/roadmaps/:id', component: () => import('../views/RoadmapDetailView.vue') },
      { path: 'learning/milestones/new', component: () => import('../views/LearningEntityView.vue'), meta: { entity:'milestones' } },
      { path: 'learning/milestones/:id', component: () => import('../views/MilestoneDetailView.vue') },
      { path: 'learning/milestones/:id/edit', component: () => import('../views/LearningEntityView.vue'), meta: { entity:'milestones' } },
      { path: 'learning/records/new', component: () => import('../views/LearningRecordEditView.vue') },
      { path: 'learning/tasks/:id', component: () => import('../views/LearningTaskDetailView.vue') },
      { path: 'learning/records/:id/edit', component: () => import('../views/LearningRecordEditView.vue') },
      { path: 'learning/records/:id', component: () => import('../views/LearningRecordView.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(to => {
  if (Object.hasOwn(to.query,'demo')) {
    const query={...to.query}
    delete query.demo
    return {path:to.path,query,hash:to.hash,replace:true}
  }
})

export default router
