<template>
  <aside :class="['sidebar', { collapsed }]">

    <!-- 상단 로고 -->
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-icon">
          S
        </div>

        <div v-if="!collapsed" class="brand-text">
          <span class="brand-title">
            Schedule
          </span>

          <span class="brand-subtitle">
            Checklist
          </span>
        </div>
      </div>

      <button
        v-if="!collapsed"
        class="collapse-button"
        @click="toggleSidebar"
        title="折りたたむ"
      >
        ‹
      </button>
    </div>


    <!-- 접힌 상태에서 펼치기 -->
    <button
      v-if="collapsed"
      class="expand-button"
      @click="toggleSidebar"
      title="展開"
    >
      ›
    </button>


    <!-- 메뉴 -->
    <nav class="menu">

      <RouterLink
        to="/today"
        class="menu-item"
        :title="collapsed ? 'ホーム' : ''"
      >
        <div class="menu-icon">
          ✓
        </div>

        <span v-if="!collapsed">
          ホーム
        </span>
      </RouterLink>


      <RouterLink
        to="/calendar"
        class="menu-item"
        :title="collapsed ? 'カレンダー' : ''"
      >
        <div class="menu-icon">
          ▦
        </div>

        <span v-if="!collapsed">
          カレンダー
        </span>
      </RouterLink>

      <RouterLink
        to="/events/new"
        class="menu-item create-event-item"
        :title="collapsed ? '予定を追加' : ''"
      >
        <div class="menu-icon">
          ＋
        </div>

        <span v-if="!collapsed">
          予定を追加
        </span>
      </RouterLink>

      <section class="roadmap-navigation">
        <button
          type="button"
          class="menu-item roadmap-toggle"
          :class="{ 'roadmap-current': learningRoute }"
          title="ロードマップ"
          :aria-expanded="roadmapOpen && !collapsed"
          aria-controls="roadmap-submenu"
          @click="toggleRoadmaps"
        >
          <span class="menu-icon">◇</span>
          <span v-if="!collapsed">ロードマップ</span>
          <span v-if="!collapsed" class="roadmap-chevron" :class="{ open: roadmapOpen }" aria-hidden="true">⌄</span>
        </button>
        <Transition name="roadmap-menu">
          <div v-if="roadmapOpen && !collapsed" id="roadmap-submenu" class="roadmap-submenu-wrap">
            <div class="roadmap-submenu">
              <RouterLink :to="learningDestination('/learning/roadmaps')" class="roadmap-submenu-item">一覧を見る</RouterLink>
              <span v-if="learning.loading" class="roadmap-menu-note" role="status">読み込み中...</span>
              <template v-if="learning.loaded && learning.roadmaps.length">
                <span class="roadmap-group-label">マイロードマップ</span>
                <div class="roadmap-saved-list">
                  <RouterLink v-for="roadmap in learning.roadmaps" :key="roadmap.roadmap_id" :to="learningDestination('/learning/roadmaps/' + roadmap.roadmap_id)" class="roadmap-submenu-item roadmap-saved-item" :title="roadmap.title">
                    <span aria-hidden="true">·</span><span>{{ roadmap.title }}</span>
                  </RouterLink>
                </div>
              </template>
              <span class="roadmap-group-label roadmap-create-label">学習を追加</span>
              <RouterLink v-for="item in learningCreateLinks" :key="item.path" :to="learningDestination(item.path)" class="roadmap-submenu-item roadmap-create-item">
                <span aria-hidden="true">＋</span><span>{{ item.label }}</span>
              </RouterLink>
            </div>
          </div>
        </Transition>
      </section>

      <RouterLink to="/settings" class="menu-item" :title="collapsed ? '設定' : ''">
        <div class="menu-icon">⚙</div>
        <span v-if="!collapsed">設定</span>
      </RouterLink>

    </nav>


    <!-- 하단 사용자 영역 -->
    <div class="sidebar-footer">

      <div
        class="user-area"
        :class="{ 'user-area-collapsed': collapsed }"
      >

        <!-- 프로필 사진 대신 이니셜 -->
        <div class="user-avatar">
          {{ userInitial }}
        </div>

        <div
          v-if="!collapsed"
          class="user-info"
        >
          <div class="user-name">
            {{ user.userName || 'ユーザー' }}
          </div>

          <div class="user-email">
            {{ user.email }}
          </div>
        </div>

      </div>


      <!-- 로그아웃 -->
      <button
        class="logout-button"
        :class="{ 'logout-collapsed': collapsed }"
        :title="collapsed ? 'ログアウト' : ''"
        @click="logout"
      >
        <span class="logout-icon">
          ↪
        </span>

        <span v-if="!collapsed">
          ログアウト
        </span>
      </button>

    </div>

  </aside>
</template>


<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { useLearning } from '../composables/useLearning'

const learningCreateLinks = [
  { path:'/learning/roadmaps/new', label:'ロードマップ作成' },
  { path:'/learning/milestones/new', label:'マイルストーン作成' },
  { path:'/learning/records/new', label:'学習記録作成' }
]

const router = useRouter()
const route = useRoute()
const { state:learning, load:loadLearning } = useLearning()
const learningRoute = computed(() => route.path.startsWith('/learning/'))
const roadmapOpen = ref(learningRoute.value)
const learningDestination = path => path

function toggleRoadmaps() {
  // Keep the existing compact sidebar usable without squeezing nested labels.
  if (window.matchMedia('(max-width: 1050px)').matches) {
    router.push(learningDestination('/learning/roadmaps'))
    return
  }
  if (collapsed.value) { collapsed.value=false; roadmapOpen.value=true }
  else roadmapOpen.value=!roadmapOpen.value
  if (roadmapOpen.value) loadLearning().catch(() => {})
}

watch(() => route.path, () => {
  if (learningRoute.value) roadmapOpen.value=true
})

const collapsed = ref(false)

const user = ref({
  userId: null,
  userName: '',
  email: ''
})


/* 사용자 이름 첫 글자 */
const userInitial = computed(() => {
  if (!user.value.userName) {
    return 'U'
  }

  return user.value.userName.charAt(0).toUpperCase()
})


/* 사이드바 접기 */
function toggleSidebar() {
  collapsed.value = !collapsed.value
}


/* 로그인 사용자 정보 조회 */
async function loadUser() {
  try {

    const response = await axios.get(
      API_ORIGIN + '/api/users/me',
      {
        withCredentials: true
      }
    )

    user.value = response.data



  } catch (error) {

    console.error(
      '사용자 정보 조회 실패:',
      error
    )

    /* 세션 만료 */
    if (error.response?.status === 401) {
      router.push('/login')
    }

  }
}


/* 로그아웃 */
async function logout() {
  try {

    await axios.post(
      API_ORIGIN + '/auth/logout',
      {},
      {
        withCredentials: true
      }
    )

    router.push('/login')

  } catch (error) {

    console.error(
      '로그아웃 실패:',
      error
    )

  }
}


onMounted(() => {
  loadUser()
  if (roadmapOpen.value) loadLearning().catch(() => {})
})
</script>


<style scoped>

/* =============================
   Sidebar
============================= */

.sidebar {
  width: 240px;
  height: 100vh;
  flex-shrink: 0;

  display: flex;
  flex-direction: column;

  padding: 18px 14px;

  box-sizing: border-box;

  background: #ffffff;

  border-right: 1px solid #d7dde7;

  transition:
    width 0.25s ease,
    padding 0.25s ease;

  overflow: hidden;

  position: relative;
}


/* 접힌 상태 */

.sidebar.collapsed {
  width: 76px;

  padding-left: 10px;
  padding-right: 10px;
}


/* =============================
   Header
============================= */

.sidebar-header {
  height: 52px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 28px;
}


.brand {
  display: flex;
  align-items: center;

  gap: 12px;

  min-width: 0;
}


.brand-icon {
  width: 40px;
  height: 40px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  background: #273c5c;

  color: white;

  font-size: 18px;
  font-weight: 700;
}


.brand-text {
  display: flex;
  flex-direction: column;

  white-space: nowrap;
}


.brand-title {
  font-size: 15px;
  font-weight: 700;

  color: #202b3c;

  line-height: 1.1;
}


.brand-subtitle {
  margin-top: 4px;

  font-size: 11px;

  color: #98a2b3;
}


/* =============================
   접기 버튼
============================= */

.collapse-button {
  width: 30px;
  height: 30px;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  border: 1px solid #e4e9f0;

  border-radius: 8px;

  background: white;

  color: #667085;

  font-size: 22px;

  cursor: pointer;

  transition: all 0.2s ease;
}


.collapse-button:hover {
  color: #2563eb;

  background: #f4f7ff;

  border-color: #cddcff;
}


.expand-button {
  width: 36px;
  height: 32px;

  margin: 0 auto 22px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;

  border-radius: 9px;

  background: #f5f7fb;

  color: #667085;

  font-size: 22px;

  cursor: pointer;

  transition: all 0.2s ease;
}


.expand-button:hover {
  background: #edf3ff;

  color: #2563eb;
}


/* =============================
   Menu
============================= */

.menu {
  display: flex;
  flex-direction: column;

  gap: 7px;
  overflow-y: auto;
  min-height: 0;
}
.menu-item { flex-shrink:0; }
.roadmap-navigation { flex-shrink:0; }
.roadmap-toggle { width:100%; border:0; background:transparent; font-family:inherit; cursor:pointer; text-align:left; }
.roadmap-current { background:#eef3fc; color:#315cbb; font-weight:600; }
.roadmap-chevron { margin-left:auto; transition:transform .2s ease; font-size:18px; }
.roadmap-chevron.open { transform:rotate(180deg); }
.roadmap-submenu-wrap { display:grid; grid-template-rows:1fr; }
.roadmap-submenu { min-height:0; overflow:hidden; display:flex; flex-direction:column; gap:4px; margin:5px 0 7px 23px; padding-left:13px; border-left:1px solid #dbe3ef; }
.roadmap-submenu-item { min-height:35px; padding:7px 9px; display:flex; align-items:center; gap:7px; border-radius:7px; color:#66758c; font-size:12px; line-height:1.5; text-decoration:none; box-sizing:border-box; }
.roadmap-submenu-item:hover { background:#f0f4fa; color:#315cbb; }
.roadmap-submenu-item.router-link-active { background:#eaf0fc; color:#315cbb; font-weight:600; }
.roadmap-saved-list { max-height:180px; overflow-y:auto; }
.roadmap-saved-item > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.roadmap-group-label,.roadmap-menu-note { padding:5px 9px; font-size:10px; color:#98a2b3; }
.roadmap-create-label { margin-top:6px; padding-top:12px; border-top:1px solid #e5eaf2; }
.roadmap-create-item { color:#718099; }
.roadmap-toggle:focus-visible,.roadmap-submenu-item:focus-visible { outline:2px solid #315cbb; outline-offset:2px; }
.roadmap-menu-enter-active,.roadmap-menu-leave-active { overflow:hidden; transition:grid-template-rows .2s ease,opacity .2s ease; }
.roadmap-menu-enter-from,.roadmap-menu-leave-to { grid-template-rows:0fr; opacity:0; }


.menu-item {
  height: 46px;

  display: flex;
  align-items: center;

  gap: 14px;

  padding: 0 14px;

  box-sizing: border-box;

  border-radius: 11px;

  color: #667085;

  text-decoration: none;

  font-size: 14px;
  font-weight: 500;

  white-space: nowrap;

  transition: all 0.2s ease;
}


.menu-item:hover {
  color: #244a9a;
  background: #eef1f5;
}


.menu-icon {
  width: 20px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 17px;
}


/* 현재 페이지 */

.router-link-active {
  color: #ffffff;
  background: #315cbb;
  font-weight: 600;
}

.create-event-item {
  margin-top: 7px;
  border: 1px solid #d5dce6;
}

.create-event-item.router-link-active {
  border-color: #315cbb;
}


/* 접힌 상태 메뉴 */

.collapsed .menu-item {
  padding: 0;

  justify-content: center;
}


/* =============================
   Sidebar footer
============================= */

.sidebar-footer {
  margin-top: auto;
}


/* 사용자 */

.user-area {
  min-height: 60px;

  display: flex;
  align-items: center;

  gap: 11px;

  padding: 10px;

  box-sizing: border-box;

  border-radius: 12px;

  background: #eef1f5;

  margin-bottom: 8px;
}


.user-area-collapsed {
  justify-content: center;

  padding: 10px 0;
}


/* 프로필 사진 대신 이니셜 */

.user-avatar {
  width: 36px;
  height: 36px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: #dfe6f2;
  color: #273c5c;

  font-size: 14px;
  font-weight: 700;
}


.user-info {
  min-width: 0;
}


.user-name {
  color: #273244;

  font-size: 13px;
  font-weight: 600;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;
}


.user-email {
  max-width: 150px;

  margin-top: 3px;

  color: #98a2b3;

  font-size: 11px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;
}


/* =============================
   Logout
============================= */

.logout-button {
  width: 100%;
  height: 42px;

  display: flex;
  align-items: center;

  gap: 12px;

  padding: 0 14px;

  box-sizing: border-box;

  border: none;

  border-radius: 10px;

  background: transparent;

  color: #7b8798;

  font-size: 13px;

  cursor: pointer;

  transition: all 0.2s ease;
}


.logout-button:hover {
  color: #dc4545;

  background: #fff2f2;
}


.logout-icon {
  width: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  font-size: 17px;
}


.logout-collapsed {
  justify-content: center;

  padding: 0;
}

@media (max-width: 1050px) {
  .roadmap-submenu-wrap { display:none; }
  .sidebar { width: 76px; padding-left: 10px; padding-right: 10px; }
  .brand-text, .user-info, .menu-item > span, .logout-button > span:not(.logout-icon), .collapse-button { display: none; }
  .brand { justify-content: center; width: 100%; }
  .menu-item, .logout-button { justify-content: center; padding-left: 0; padding-right: 0; }
  .user-area { justify-content: center; padding-left: 0; padding-right: 0; }
}

@media (max-width: 700px) {
  .sidebar, .sidebar.collapsed { position: fixed; inset: auto 0 0 0; z-index: 50; width: 100%; height: 62px; padding: 7px 10px; border-top: 1px solid #d7dde7; border-right: 0; }
  .sidebar-header, .sidebar-footer, .expand-button { display: none; }
  .menu { width: 100%; height: 100%; flex-direction: row; gap: 6px; }
  .menu-item, .collapsed .menu-item { flex: 1; height: 48px; margin: 0; padding: 0; justify-content: center; }
  .menu-icon { width: auto; }
}

</style>
