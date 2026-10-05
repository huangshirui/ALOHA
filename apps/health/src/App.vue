<template>
  <main class="aloha-surface health-surface" data-aloha-surface="health">
    <div class="aloha-surface-frame">
      <header class="aloha-surface-header">
        <div>
          <p class="aloha-kicker">ALOHA</p>
          <strong>Health</strong>
        </div>
        <button class="aloha-icon-button" type="button" aria-label="Health 设置">⋯</button>
      </header>

      <section class="aloha-surface-content">
        <div class="aloha-content-reading">
          <section class="aloha-card health-ready-card">
            <p class="aloha-kicker">ALOHA Health</p>
            <h1>开发基座已就绪</h1>
            <p class="aloha-muted">
              当前仅建立跨端 UI、PWA 与独立发布边界。健康领域模型、数据源与功能将在独立开发阶段确定。
            </p>
          </section>

          <div class="aloha-responsive-grid health-readiness" data-wide-columns="3">
            <section class="aloha-card">
              <strong>Mobile</strong>
              <p class="aloha-muted">触控优先、单列信息架构。</p>
            </section>
            <section class="aloha-card">
              <strong>Tablet</strong>
              <p class="aloha-muted">允许主从或双栏布局。</p>
            </section>
            <section class="aloha-card">
              <strong>Desktop</strong>
              <p class="aloha-muted">允许更高信息密度与多栏工作区。</p>
            </section>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
