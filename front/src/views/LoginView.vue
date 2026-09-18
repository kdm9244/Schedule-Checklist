<script setup>
const googleLogin = () => {
  window.location.href = 'http://localhost:3000/auth/google'
}
</script>

<template>
  <main class="login-page">

    <!-- 왼쪽 영역 -->
    <section class="visual-section">
      <div class="visual-content">

        <div class="brand">
          <div class="brand-icon">✓</div>
          <span>Schedule Checklist</span>
        </div>

        <div class="main-message">
          <p class="message-eyebrow">PLAN · PREPARE · COMPLETE</p>
          <h1>
            予定の先にある準備まで、<br />
            一つの画面で。
          </h1>

          <p class="description">
            Googleカレンダーの予定ごとに必要なタスクを整理。<br />
            今日やることと、予定の準備を迷わず確認できます。
          </p>

          <div class="feature-list">
            <span><b>01</b> 予定を自動で確認</span>
            <span><b>02</b> 準備項目をチェック</span>
            <span><b>03</b> 今日のメモを保存</span>
          </div>
        </div>

        <!-- 일정 미리보기 카드 -->
        <div class="preview-card">
          <div class="preview-header">
            <div>
              <small>TODAY</small>
              <strong>今日の予定</strong>
            </div>
            <span class="preview-date">9月16日</span>
          </div>

          <div class="preview-event">
            <div class="time">09:00</div>

            <div class="event-content">
              <strong>出勤</strong>
              <p class="done">✓ 社員証を確認</p>
            </div>
            <span class="preview-count">1/1</span>
          </div>

          <div class="preview-event">
            <div class="time">13:00</div>

            <div class="event-content">
              <strong>DB研修</strong>
              <p>○ 教材を準備</p>
            </div>
            <span class="preview-count">1/3</span>
          </div>

          <div class="preview-event">
            <div class="time">18:30</div>

            <div class="event-content">
              <strong>Java学習</strong>
              <p>○ 復習する</p>
            </div>
            <span class="preview-count">0/2</span>
          </div>

          <div class="preview-progress">
            <span>今日の準備</span>
            <strong>2 / 6 完了</strong>
          </div>
        </div>

      </div>
    </section>

    <!-- 오른쪽 로그인 영역 -->
    <section class="login-section">
      <div class="login-container">

        <div class="login-header">
          <p class="welcome">WELCOME</p>

          <h2>おかえりなさい</h2>

          <p class="login-description">
            Googleアカウントでログインして、<br />
            今日の予定を確認しましょう。
          </p>
        </div>

        <button
          type="button"
          class="google-button"
          @click="googleLogin"
        >
          <svg
            class="google-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.51c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.39 13.89A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.89V7.5H3.04A10 10 0 0 0 2 12c0 1.62.39 3.15 1.04 4.5l3.35-2.61Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.5l3.35 2.61C7.18 7.74 9.39 5.98 12 5.98Z"
            />
          </svg>

          <span>Googleでログイン</span>
        </button>

        <div class="notice">
          <div class="notice-icon">i</div>

          <p>
            Googleカレンダーとの連携には<br />
            Googleアカウントが必要です。
          </p>
        </div>

        <p class="footer">
          © 2026 Schedule Checklist
        </p>

      </div>
    </section>

  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.login-page {
  width: 100%;
  height: 100%;

  display: flex;

  overflow: hidden;

  font-family:
    Inter,
    "Noto Sans JP",
    "Yu Gothic",
    "Hiragino Kaku Gothic ProN",
    sans-serif;

  color: #1e293b;
}

/* =========================
   왼쪽 블루 영역
========================= */

.visual-section {
  width: 70%;
  height: 100%;

  position: relative;
  overflow: hidden;

  background: #273c5c;

  color: white;
}

.visual-section::before {
  content: "";

  position: absolute;

  width: 430px;
  height: 430px;

  top: -220px;
  right: -110px;

  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.visual-section::after {
  content: "";

  position: absolute;

  width: 520px;
  height: 520px;

  bottom: -330px;
  left: -180px;

  border-radius: 50%;

  border: 1px solid rgba(255, 255, 255, 0.1);
}

.visual-content {
  width: 100%;
  height: 100%;

  padding: 48px 8%;

  display: flex;
  flex-direction: column;

  position: relative;
  z-index: 1;
}

/* =========================
   브랜드
========================= */

.brand {
  display: flex;
  align-items: center;

  gap: 12px;

  font-size: 18px;
  font-weight: 700;
}

.brand-icon {
  width: 38px;
  height: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  background: rgba(255, 255, 255, 0.18);

  font-size: 21px;
}

/* =========================
   메인 문구
========================= */

.main-message {
  margin-top: 9vh;
}

.message-eyebrow {
  margin: 0 0 18px;
  color: #9fb7df;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 2.2px;
}

.main-message h1 {
  margin: 0;

  font-size: clamp(42px, 4vw, 66px);
  line-height: 1.35;

  letter-spacing: -2px;
}

.description {
  margin-top: 26px;

  font-size: 16px;
  line-height: 1.8;

  color: #d7dfeb;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.feature-list span {
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: #314969;
  color: #edf2f8;
  font-size: 11px;
}

.feature-list b {
  margin-right: 6px;
  color: #9fb7df;
}

/* =========================
   일정 미리보기
========================= */

.preview-card {
  width: 430px;

  margin-top: auto;
  margin-left: auto;

  padding: 20px 24px;

  border: 1px solid #d8e0eb;
  border-radius: 20px;

  background: #ffffff;
  color: #243247;
  box-shadow: 0 20px 45px rgba(10, 24, 45, 0.28);
}

.preview-header {
  display: flex;
  justify-content: space-between;

  padding-bottom: 14px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.15);

  font-size: 13px;
  color: #526176;
}

.preview-header div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-header small {
  color: #315cbb;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1.4px;
}

.preview-header strong {
  color: #273c5c;
  font-size: 14px;
}

.preview-date {
  align-self: center;
  padding: 5px 8px;
  border-radius: 7px;
  background: #e9edf3;
  color: #536176;
}

.preview-event {
  display: flex;

  gap: 18px;

  padding: 14px 0;

  align-items: center;
  border-bottom: 1px solid #e7ebf1;
}

.preview-event:last-child {
  border-bottom: none;
}

.time {
  min-width: 54px;

  font-size: 13px;

  color: #315cbb;
  font-weight: 700;
}

.event-content strong {
  font-size: 14px;
}

.event-content p {
  margin: 5px 0 0;

  font-size: 12px;

  color: #758196;
}

.event-content .done {
  color: #16856b;
}

.preview-count {
  margin-left: auto;
  padding: 4px 7px;
  border-radius: 999px;
  background: #e9edf3;
  color: #273c5c;
  font-size: 10px;
  font-weight: 700;
}

.preview-progress {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 9px;
  background: #edf5f2;
  color: #507066;
  font-size: 11px;
}

.preview-progress strong {
  color: #126d58;
}

/* =========================
   오른쪽 로그인 영역
========================= */

.login-section {
  width: 30%;
  height: 100%;

  min-width: 390px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #ffffff;
}

.login-container {
  width: 100%;
  max-width: 360px;

  padding: 0 38px;
}

.login-header {
  margin-bottom: 36px;
}

.welcome {
  margin: 0 0 16px;

  font-size: 12px;
  font-weight: 800;

  letter-spacing: 2.2px;

  color: #315cbb;
}

.login-header h2 {
  margin: 0 0 16px;

  font-size: 30px;

  color: #0f172a;

  letter-spacing: -1px;
}

.login-description {
  margin: 0;

  font-size: 14px;
  line-height: 1.8;

  color: #64748b;
}

/* =========================
   Google 버튼
========================= */

.google-button {
  width: 100%;
  height: 56px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 13px;

  border: 1px solid #dbe3ef;
  border-radius: 12px;

  background: #ffffff;

  color: #1e293b;

  font-size: 15px;
  font-weight: 600;

  cursor: pointer;

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.google-button:hover {
  transform: translateY(-2px);

  border-color: #315cbb;

  box-shadow: 0 8px 24px rgba(28, 54, 105, 0.12);
}

.google-button:active {
  transform: translateY(0);
}

.google-icon {
  width: 21px;
  height: 21px;
}

/* =========================
   안내 영역
========================= */

.notice {
  margin-top: 26px;

  padding: 14px;

  display: flex;

  gap: 12px;

  border-radius: 10px;

  border: 1px solid #d8e0eb;
  background: #eef1f5;
}

.notice-icon {
  width: 20px;
  height: 20px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: #273c5c;

  color: white;

  font-size: 11px;
  font-weight: 700;
}

.notice p {
  margin: 0;

  font-size: 11px;
  line-height: 1.65;

  color: #64748b;
}

/* =========================
   footer
========================= */

.footer {
  margin-top: 42px;

  text-align: center;

  color: #94a3b8;

  font-size: 11px;
}

/* =========================
   반응형
========================= */

@media (max-width: 1100px) {
  .visual-section {
    width: 62%;
  }

  .login-section {
    width: 38%;
  }

  .preview-card {
    width: 390px;
  }
}

@media (max-width: 820px) {
  .visual-section {
    display: none;
  }

  .login-section {
    width: 100%;
    min-width: 0;
  }

  .login-container {
    max-width: 430px;
  }
}
</style>
