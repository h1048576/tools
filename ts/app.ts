/* ==========================================================================
 * app.ts — 应用外壳：hash 路由、侧边菜单、复制、吐司、图标
 * 编译为 js/app.js（npm run build），请勿直接改 js/ 下的产物
 * ========================================================================== */
(function () {
  'use strict';

  function svg(inner: string): string {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  const App = {
    tools: {} as Record<string, ToolDef>,
    current: null as string | null,
    _toastTimer: 0,

    icons: {
      asterisk: svg('<path d="M12 3.5v17"/><path d="M4.5 7.75l15 8.5"/><path d="M19.5 7.75l-15 8.5"/>'),
      braces: svg('<path d="M9 3.5c-2 0-3 1-3 3v2c0 1.4-.8 2.3-2.5 2.5v2c1.7.2 2.5 1.1 2.5 2.5v2c0 2 1 3 3 3"/>' +
        '<path d="M15 3.5c2 0 3 1 3 3v2c0 1.4.8 2.3 2.5 2.5v2c-1.7.2-2.5 1.1-2.5 2.5v2c0 2-1 3-3 3"/>'),
      clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
      copy: svg('<rect x="9" y="9" width="11" height="11" rx="2.5"/>' +
        '<path d="M5.5 14.5V6A2.5 2.5 0 0 1 8 3.5h8.5"/>'),
      check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
      warn: svg('<path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4"/><path d="M12 16.8v.2"/>'),
      menu: svg('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
      close: svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
      chevron: svg('<path d="M9 6l6 6-6 6"/>'),
      minimize: svg('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'),
      maximize: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
      moon: svg('<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>'),
      sun: svg('<circle cx="12" cy="12" r="4"/>' +
        '<path d="M12 2.5V5"/><path d="M12 19v2.5"/><path d="M2.5 12H5"/><path d="M19 12h2.5"/>' +
        '<path d="M5.3 5.3l1.8 1.8"/><path d="M16.9 16.9l1.8 1.8"/>' +
        '<path d="M18.7 5.3l-1.8 1.8"/><path d="M7.1 16.9l-1.8 1.8"/>')
    } as Record<string, string>,

    registerTool(id: string, def: ToolDef) {
      this.tools[id] = def;
    },

    init() {
      this.initTheme();

      // 先渲染各工具页，再统一填充图标，最后克隆菜单到移动端抽屉
      for (const [id, def] of Object.entries(this.tools)) {
        const host = document.getElementById('tool-' + id);
        if (host && typeof def.render === 'function') def.render(host);
      }
      this._fillIcons();

      document.querySelectorAll('.theme-toggle').forEach((btn) => {
        btn.addEventListener('click', () => this.toggleTheme());
      });

      const desktopMenu = document.querySelector('.sidebar .menu');
      const sheetInner = document.querySelector('#mobileSheet .sheet-inner');
      if (desktopMenu && sheetInner) sheetInner.appendChild(desktopMenu.cloneNode(true));

      window.addEventListener('hashchange', () => this.route());

      const toggle = document.getElementById('menuToggle');
      const sheet = document.getElementById('mobileSheet');
      if (toggle && sheet) {
        toggle.addEventListener('click', () => sheet.classList.toggle('open'));
      }
      if (sheet) {
        sheet.addEventListener('click', (e) => {
          const t = e.target as HTMLElement;
          if (t.closest('a') || t.closest('.sheet-close')) {
            sheet.classList.remove('open');
          }
        });
      }

      this.route();
    },

    _fillIcons() {
      document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
        const name = el.getAttribute('data-icon');
        if (!name) return;
        const icon = this.icons[name];
        if (icon) el.innerHTML = icon;
      });
    },

    // —— 白 / 黑主题 ——（深色方案见 style.css 的 html[data-theme="dark"]）

    initTheme() {
      let saved: string | null = null;
      try { saved = localStorage.getItem('theme'); } catch { /* file:// 下可能被禁用 */ }
      const theme = saved === 'dark' || saved === 'light'
        ? saved
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      this.applyTheme(theme, true);
    },

    applyTheme(theme: 'dark' | 'light', silent?: boolean) {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('theme', theme); } catch { /* noop */ }
      if (!silent) {
        this.toast(theme === 'dark' ? '已切换到黑色主题' : '已切换到白色主题');
      }
    },

    toggleTheme() {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
    },

    route() {
      const id = (location.hash || '#json').slice(1);
      const target = this.tools[id] ? id : 'json';

      if (this.current && this.current !== target) {
        const prev = this.tools[this.current];
        if (prev && typeof prev.onHide === 'function') prev.onHide();
      }

      document.querySelectorAll<HTMLElement>('.tool-page').forEach((el) => {
        el.hidden = el.id !== 'tool-' + target;
      });
      document.querySelectorAll<HTMLElement>('.menu-item[data-tool]').forEach((a) => {
        a.classList.toggle('active', a.dataset.tool === target);
      });
      document.title = this.tools[target].title + ' · 工具集';

      this.current = target;
      const def = this.tools[target];
      if (typeof def.onShow === 'function') def.onShow();
    },

    toast(msg: string) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    },

    async copy(text: string): Promise<boolean> {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* noop */ }
        ta.remove();
        return ok;
      }
    },

    // 绑定复制按钮：点击复制 getText() 的返回值，图标短暂切换为对勾并弹出吐司
    bindCopy(btn: HTMLElement | null, getText: () => string, okMsg?: string) {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const text = getText();
        if (!text) { this.toast('暂无可复制的内容'); return; }
        const ok = await this.copy(text);
        if (ok) {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1200);
          this.toast(okMsg || '已复制到剪贴板');
        } else {
          this.toast('复制失败，请手动选择复制');
        }
      });
    },

    // 复制「结果行」里由 data-copy-id 指向的元素文本（'—' 视为空）
    bindCopyRow(root: HTMLElement) {
      root.querySelectorAll<HTMLElement>('[data-copy-id]').forEach((btn) => {
        const id = btn.dataset.copyId;
        if (!id) return;
        const el = document.getElementById(id);
        if (!el) return;
        this.bindCopy(btn, () => {
          const t = el.textContent!.trim();
          return !t || t === '—' ? '' : t;
        });
      });
    },

    escapeHtml(str: unknown): string {
      const MAP: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      };
      return String(str).replace(/[&<>"']/g, (c) => MAP[c]);
    },

    fmtBytes(n: number): string {
      return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
    },

    byteLength(str: string): number {
      try { return new TextEncoder().encode(str).length; }
      catch { return str.length; }
    },

    pad2(n: number): string { return String(n).padStart(2, '0'); },

    WEEKDAYS: ['日', '一', '二', '三', '四', '五', '六']
  };

  window.App = App;
})();
