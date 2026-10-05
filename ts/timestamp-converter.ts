/* ==========================================================================
 * timestamp-converter.ts — 时间戳转换工具
 * 实时时钟、时间戳 ↔ 日期双向转换（秒/毫秒自动识别）、ISO 8601
 * 编译为 js/timestamp-converter.js（npm run build），请勿直接改 js/ 下的产物
 * ========================================================================== */
(function () {
  'use strict';

  const AUTO_MS_THRESHOLD = 1e12; // 自动模式下：绝对值 ≥ 1e12 视为毫秒（即 2001-09 之后）

  function pad(n: number): string { return App.pad2(n); }

  function fmtLocal(d: Date): string {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function fmtUtc(d: Date): string {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
      ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  function weekday(d: Date): string { return '星期' + App.WEEKDAYS[d.getDay()]; }

  function fmtCnDate(d: Date): string {
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · ' + weekday(d);
  }

  function toLocalInputValue(d: Date): string {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  const tool = {
    title: '时间戳',
    _timer: 0,
    clockTime: null as unknown as HTMLElement,
    clockDate: null as unknown as HTMLElement,
    clockSec: null as unknown as HTMLElement,
    clockMs: null as unknown as HTMLElement,
    tsInput: null as unknown as HTMLInputElement,
    tsUnit: null as unknown as HTMLSelectElement,
    tsUnitBadge: null as unknown as HTMLElement,
    tsError: null as unknown as HTMLElement,
    tsErrorMsg: null as unknown as HTMLElement,
    tsIds: [] as HTMLElement[],
    dateInput: null as unknown as HTMLInputElement,
    dateIds: [] as HTMLElement[],

    render(root: HTMLElement): void {
      root.innerHTML = `
        <header class="tool-header">
          <div>
            <h1 class="tool-title">时间戳</h1>
          </div>
          <span class="badge-pill">本地运行</span>
        </header>

        <section class="clock-card">
          <div class="clock-main">
            <div class="clock-date" id="clockDate">—</div>
            <div class="clock-time"><span id="clockTime">--:--:--</span></div>
          </div>
          <div class="clock-chips">
            <div class="chip">
              <div>
                <span class="chip-label">UNIX · 秒</span>
                <code class="chip-value" id="clockSec">—</code>
              </div>
              <button type="button" class="icon-btn" data-copy-id="clockSec" title="复制秒级时间戳">
                <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
              </button>
            </div>
            <div class="chip">
              <div>
                <span class="chip-label">UNIX · 毫秒</span>
                <code class="chip-value" id="clockMs">—</code>
              </div>
              <button type="button" class="icon-btn" data-copy-id="clockMs" title="复制毫秒级时间戳">
                <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
              </button>
            </div>
          </div>
        </section>

        <div class="ts-grid">
          <section class="card">
            <h2 class="card-title">时间戳 → 日期
              <span class="badge-pill" id="tsUnitBadge" hidden></span>
            </h2>
            <div class="field-row">
              <input type="text" id="tsInput" class="input mono" inputmode="numeric" spellcheck="false"
                placeholder="例如 1791234567 或 1791234567890" />
              <select id="tsUnit" class="select" aria-label="时间戳单位">
                <option value="auto">自动识别</option>
                <option value="s">秒</option>
                <option value="ms">毫秒</option>
              </select>
            </div>
            <div class="error-line" id="tsError" hidden>
              <span data-icon="warn"></span><span id="tsErrorMsg"></span>
            </div>
            <div class="results">
              <div class="result-row">
                <span class="result-label">本地时间</span>
                <code class="result-value empty" id="tsLocal">—</code>
                <span class="result-extra" id="tsLocalExtra"></span>
                <button type="button" class="icon-btn" data-copy-id="tsLocal" title="复制本地时间">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
              <div class="result-row">
                <span class="result-label">UTC 时间</span>
                <code class="result-value empty" id="tsUtc">—</code>
                <button type="button" class="icon-btn" data-copy-id="tsUtc" title="复制 UTC 时间">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
              <div class="result-row">
                <span class="result-label">ISO 8601</span>
                <code class="result-value empty" id="tsIso">—</code>
                <button type="button" class="icon-btn" data-copy-id="tsIso" title="复制 ISO 8601">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
            </div>
          </section>

          <section class="card">
            <h2 class="card-title">日期 → 时间戳</h2>
            <div class="field-row">
              <input type="datetime-local" id="dateInput" class="input mono" step="1" />
              <button type="button" id="btnNow" class="btn btn-secondary">现在</button>
            </div>
            <div class="results">
              <div class="result-row">
                <span class="result-label">Unix 秒</span>
                <code class="result-value empty" id="dateSec">—</code>
                <button type="button" class="icon-btn" data-copy-id="dateSec" title="复制秒级时间戳">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
              <div class="result-row">
                <span class="result-label">Unix 毫秒</span>
                <code class="result-value empty" id="dateMs">—</code>
                <button type="button" class="icon-btn" data-copy-id="dateMs" title="复制毫秒级时间戳">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
              <div class="result-row">
                <span class="result-label">ISO 8601</span>
                <code class="result-value empty" id="dateIso">—</code>
                <button type="button" class="icon-btn" data-copy-id="dateIso" title="复制 ISO 8601">
                  <span data-icon="copy" class="ic-copy"></span><span data-icon="check" class="ic-check"></span>
                </button>
              </div>
            </div>
          </section>
        </div>`;

      this.clockTime = root.querySelector<HTMLElement>('#clockTime')!;
      this.clockDate = root.querySelector<HTMLElement>('#clockDate')!;
      this.clockSec = root.querySelector<HTMLElement>('#clockSec')!;
      this.clockMs = root.querySelector<HTMLElement>('#clockMs')!;

      this.tsInput = root.querySelector<HTMLInputElement>('#tsInput')!;
      this.tsUnit = root.querySelector<HTMLSelectElement>('#tsUnit')!;
      this.tsUnitBadge = root.querySelector<HTMLElement>('#tsUnitBadge')!;
      this.tsError = root.querySelector<HTMLElement>('#tsError')!;
      this.tsErrorMsg = root.querySelector<HTMLElement>('#tsErrorMsg')!;
      this.tsIds = ['tsLocal', 'tsLocalExtra', 'tsUtc', 'tsIso']
        .map((id) => root.querySelector<HTMLElement>('#' + id)!);

      this.dateInput = root.querySelector<HTMLInputElement>('#dateInput')!;
      this.dateIds = ['dateSec', 'dateMs', 'dateIso'].map((id) => root.querySelector<HTMLElement>('#' + id)!);

      this.tsInput.addEventListener('input', () => this.convertTs());
      this.tsUnit.addEventListener('change', () => this.convertTs());

      this.dateInput.addEventListener('input', () => this.convertDate());
      root.querySelector('#btnNow')!.addEventListener('click', () => {
        this.dateInput.value = toLocalInputValue(new Date());
        this.convertDate();
      });

      App.bindCopyRow(root);
      this.resetTs();
      this.dateInput.value = toLocalInputValue(new Date());
      this.convertDate();
    },

    onShow(): void { this.startClock(); },
    onHide(): void { this.stopClock(); },

    startClock(): void {
      this.tick();
      if (!this._timer) this._timer = setInterval(() => this.tick(), 1000);
    },

    stopClock(): void {
      clearInterval(this._timer);
      this._timer = 0;
    },

    tick(): void {
      const now = new Date();
      this.clockTime.textContent =
        pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      this.clockDate.textContent = fmtCnDate(now);
      this.clockSec.textContent = String(Math.floor(now.getTime() / 1000));
      this.clockMs.textContent = String(now.getTime());
    },

    setRow(el: HTMLElement, value: string): void {
      el.textContent = value;
      el.classList.toggle('empty', value === '—');
    },

    resetTs(): void {
      this.tsIds.forEach((el) => this.setRow(el, '—'));
      this.tsError.hidden = true;
      this.tsUnitBadge.hidden = true;
    },

    tsFail(msg: string): void {
      this.tsIds.forEach((el) => this.setRow(el, '—'));
      this.tsUnitBadge.hidden = true;
      this.tsErrorMsg.textContent = msg;
      this.tsError.hidden = false;
    },

    convertTs(): void {
      const raw = this.tsInput.value.trim();
      if (!raw) { this.resetTs(); return; }

      const cleaned = raw.replace(/[,\s_]/g, '');
      if (!/^-?\d+$/.test(cleaned)) {
        this.tsFail('请输入有效的整数时间戳'); return;
      }
      const v = Number(cleaned);
      if (!Number.isSafeInteger(v)) {
        this.tsFail('数值超出 JavaScript 安全整数范围'); return;
      }

      const unit = this.tsUnit.value;
      const isMs = unit === 'ms' || (unit === 'auto' && Math.abs(v) >= AUTO_MS_THRESHOLD);
      const d = new Date(isMs ? v : v * 1000);
      if (isNaN(d.getTime())) { this.tsFail('无法解析为有效日期'); return; }

      this.tsError.hidden = true;
      if (unit === 'auto') {
        this.tsUnitBadge.textContent = isMs ? '按毫秒解析' : '按秒解析';
        this.tsUnitBadge.hidden = false;
      } else {
        this.tsUnitBadge.hidden = true;
      }

      this.setRow(this.tsIds[0], fmtLocal(d));
      this.tsIds[1].textContent = weekday(d);
      this.setRow(this.tsIds[2], fmtUtc(d));
      this.setRow(this.tsIds[3], d.toISOString());
    },

    convertDate(): void {
      const v = this.dateInput.value;
      if (!v) {
        this.dateIds.forEach((el) => this.setRow(el, '—'));
        return;
      }
      const d = new Date(v);
      if (isNaN(d.getTime())) {
        this.dateIds.forEach((el) => this.setRow(el, '—'));
        return;
      }
      this.setRow(this.dateIds[0], String(Math.floor(d.getTime() / 1000)));
      this.setRow(this.dateIds[1], String(d.getTime()));
      this.setRow(this.dateIds[2], d.toISOString());
    }
  };

  App.registerTool('timestamp', tool);
})();
