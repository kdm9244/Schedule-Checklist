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
          <p>キャル株式会社 オリジナル作品</p>
          <h1>キム・ドクモ</h1>
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
  margin: auto;
  width: min(680px, 100%);
  text-align: center;
}

.main-message h1 {
  margin: 22px 0 0;
  font-size: clamp(40px, 4vw, 58px);
  line-height: 1.25;
  letter-spacing: -.04em;
}

.main-message p {
  margin: 0;
  color: #dce5f1;
  font-size: clamp(18px, 2vw, 28px);
  font-weight: 650;
  line-height: 1.55;
  letter-spacing: .08em;
  text-wrap: balance;
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
