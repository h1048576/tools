/* ==========================================================================
 * json-formatter.js — JSON 格式化工具
 * 校验（自研轻量解析器，报错定位到行列）、美化、压缩、可折叠树形输出
 * 性能：树以 HTML 字符串一次性渲染；大 JSON 分批懒加载，避免长列表卡顿
 * ========================================================================== */
(function () {
  'use strict';

  const INDENTS = { '2': '  ', '4': '    ', 'tab': '\t' };
  const INITIAL_BUDGET = 2000; // 首次渲染最多展开的行数，超出部分折叠懒加载
  const EXPAND_BUDGET = 2000;  // 每次点击展开 / 加载时最多构建的行数

  /* ---------- 轻量 JSON 校验器：失败时给出精确的行 / 列 ---------- */

  function validateJson(text) {
    const n = text.length;
    let i = 0;
    const NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

    function lineCol(pos) {
      let line = 1, col = 1;
      for (let k = 0; k < pos && k < n; k++) {
        if (text[k] === '\n') { line++; col = 1; } else { col++; }
      }
      return { line, col };
    }

    function fail(msg, pos) {
      const p = pos === undefined ? i : pos;
      const { line, col } = lineCol(p);
      const err = new Error(msg);
      err.line = line;
      err.col = col;
      throw err;
    }

    function charDesc(c) {
      if (c === undefined) return '输入结束';
      if (c === '\n') return '换行符';
      if (c === '\t') return '制表符';
      if (c >= '\u0000' && c <= '\u001F') return '控制字符';
      return '"' + c + '"';
    }

    function ws() {
      while (i < n) {
        const c = text[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
        else break;
      }
    }

    function string() {
      i++; // 开头引号
      for (;;) {
        if (i >= n) fail('字符串未闭合（缺少结束引号）');
        const c = text[i];
        if (c === '"') { i++; return; }
        if (c === '\\') {
          const e = text[i + 1];
          if (e === undefined) fail('字符串未闭合（转义符 \\ 后没有字符）', i);
          if ('"\\/_bfnrt'.includes(e)) {
            i += 2;
          } else if (e === 'u') {
            if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
              fail('非法的 \\u 转义（需要 4 位十六进制数字）', i);
            }
            i += 6;
          } else {
            fail('非法的转义字符 \\' + e, i);
          }
          continue;
        }
        if (c >= '\u0000' && c <= '\u001F') {
          fail('字符串中包含未转义的控制字符（' + charDesc(c) + '）', i);
        }
        i++;
      }
    }

    function number() {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(text);
      if (m && m.index === i && m[0]) { i += m[0].length; return; }
      fail('无效的数字');
    }

    function value() {
      ws();
      if (i >= n) fail('意外结束：还缺少一个值');
      const c = text[i];
      if (c === '{') return object();
      if (c === '[') return array();
      if (c === '"') return string();
      if (c === '-' || (c >= '0' && c <= '9')) return number();
      if (text.startsWith('true', i)) { i += 4; return; }
      if (text.startsWith('false', i)) { i += 5; return; }
      if (text.startsWith('null', i)) { i += 4; return; }
      fail('意外的字符 ' + charDesc(c));
    }

    function object() {
      i++; // {
      ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (text[i] === '}') fail('对象中有多余的逗号');
        if (text[i] !== '"') {
          fail('对象的键必须是带引号的字符串，实际是 ' + charDesc(text[i]));
        }
        string();
        ws();
        if (text[i] !== ':') {
          fail('键后面应为冒号 ":"，实际是 ' + charDesc(text[i]));
        }
        i++;
        value();
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        fail('应为 "," 或 "}"，实际是 ' + charDesc(text[i]));
      }
    }

    function array() {
      i++; // [
      ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        if (text[i] === ']') fail('数组中有多余的逗号');
        value();
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        fail('应为 "," 或 "]"，实际是 ' + charDesc(text[i]));
      }
    }

    ws();
    if (i >= n) {
      const err = new Error('输入为空');
      err.empty = true;
      throw err;
    }
    value();
    ws();
    if (i < n) fail('JSON 解析完成后存在多余的内容，请检查是否混入了多余字符或多个值');
  }

  /* ---------- 折叠树渲染 ---------- */

  function esc(s) { return App.escapeHtml(s); }
  function isContainer(v) { return v !== null && typeof v === 'object'; }
  function entriesOf(v) {
    return Array.isArray(v)
      ? v.map((x) => [null, x])
      : Object.keys(v).map((k) => [k, v[k]]);
  }
  function countOf(v) {
    return (Array.isArray(v) ? v.length : Object.keys(v).length) + (Array.isArray(v) ? ' 项' : ' 键');
  }
  function braceOf(v) { return Array.isArray(v) ? ['[', ']'] : ['{', '}']; }

  function valueHTML(v) {
    if (typeof v === 'string') return '<span class="jt-val tok-str">' + esc(JSON.stringify(v)) + '</span>';
    if (typeof v === 'number') return '<span class="jt-val tok-num">' + String(v) + '</span>';
    return '<span class="jt-val tok-lit">' + String(v) + '</span>'; // true / false / null
  }

  function keyHTML(key) {
    return '<span class="jt-key">' + esc(JSON.stringify(key)) + '</span><span class="jt-punct">: </span>';
  }

  // 折叠态的行内摘要：{ } + 数量 + 尾逗号
  function summaryHTML(closeCh, count, isLast) {
    let h = '<span class="jt-close-inline">' + closeCh + '</span>' +
      '<span class="jt-count">' + count + '</span>';
    if (!isLast) h += '<span class="jt-tail">,</span>';
    return h;
  }

  const tool = {
    title: 'JSON',
    indent: '4',
    lastOutput: '',
    lastParsed: null,

    render(root) {
      root.innerHTML = `
        <header class="tool-header">
          <div>
            <h1 class="tool-title">JSON</h1>
          </div>
          <span class="badge-pill">本地运行</span>
        </header>

        <div class="json-layout">
          <section class="pane">
            <div class="pane-head">
              <span class="pane-title">输出</span>
              <span class="pane-head-right">
                <button type="button" id="btnExpandAll" class="btn-text">展开全部</button>
                <button type="button" id="btnCollapseAll" class="btn-text">折叠全部</button>
              </span>
            </div>
            <div class="code-window">
              <div class="json-tree" id="jsonTree" hidden></div>
              <div class="code-error" id="jsonError" hidden>
                <span data-icon="warn"></span>
                <div>
                  <div class="code-error-title">JSON 解析失败</div>
                  <div class="code-error-msg" id="jsonErrorMsg"></div>
                  <div class="code-error-pos" id="jsonErrorPos"></div>
                </div>
              </div>
            </div>
            <div class="pane-foot">
              <button type="button" id="btnMinify" class="btn btn-secondary">压缩</button>
              <button type="button" id="btnCopyJson" class="btn btn-secondary">复制</button>
            </div>
          </section>

          <section class="pane">
            <div class="pane-head">
              <span class="pane-title">输入</span>
              <div class="seg" id="indentSeg" role="group" aria-label="缩进宽度">
                <button type="button" class="seg-btn active" data-indent="4">4 空格</button>
                <button type="button" class="seg-btn" data-indent="2">2 空格</button>
                <button type="button" class="seg-btn" data-indent="tab">Tab</button>
              </div>
            </div>
            <textarea id="jsonInput" class="json-input" spellcheck="false"></textarea>
            <div class="pane-foot">
              <button type="button" id="btnFormat" class="btn btn-primary">格式化</button>
              <span class="flex-spacer"></span>
              <button type="button" id="btnClear" class="btn-text">清空</button>
            </div>
          </section>
        </div>`;

      this.input = root.querySelector('#jsonInput');
      this.seg = root.querySelector('#indentSeg');
      this.tree = root.querySelector('#jsonTree');
      this.error = root.querySelector('#jsonError');
      this.errMsg = root.querySelector('#jsonErrorMsg');
      this.errPos = root.querySelector('#jsonErrorPos');

      root.querySelector('#btnFormat').addEventListener('click', () => this.doFormat());
      root.querySelector('#btnMinify').addEventListener('click', () => this.doMinify());
      root.querySelector('#btnClear').addEventListener('click', () => this.clearAll());
      root.querySelector('#btnExpandAll').addEventListener('click', () => this.expandAll());
      root.querySelector('#btnCollapseAll').addEventListener('click', () => this.collapseAll());

      this.seg.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        this.seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.indent = btn.dataset.indent;
        if (this.lastOutput && !this.tree.hidden) this.doFormat();
      });

      this.input.addEventListener('input', () => {
        if (!this.error.hidden) this.showEmpty();
      });

      this.input.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.doFormat();
        } else if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.input.setRangeText('    ', this.input.selectionStart, this.input.selectionEnd, 'end');
        }
      });

      // 事件委托：折叠箭头 / 懒加载节点 / 「加载更多」占位行
      this.tree.addEventListener('click', (e) => {
        const more = e.target.closest('.jt-more');
        if (more) { this.loadMore(more); return; }
        const arrow = e.target.closest('.jt-arrow');
        if (!arrow) return;
        const node = arrow.closest('.jt-node');
        if (node.classList.contains('jt-lazy')) {
          this.expandLazy(node); // 首次展开：此时才构建子级
          node.classList.remove('collapsed');
        } else {
          node.classList.toggle('collapsed');
        }
      });

      App.bindCopy(root.querySelector('#btnCopyJson'), () => this.lastOutput, '已复制结果');

      this.showEmpty();
    },

    doFormat() { this.process(true); },

    doMinify() { this.process(false); },

    process(pretty) {
      const src = this.input.value.replace(/^\uFEFF/, ''); // 去掉 BOM

      if (!src.trim()) {
        this.showError({ message: '输入为空，请先粘贴或输入 JSON 内容。', line: 0, col: 0 });
        return;
      }

      try {
        validateJson(src);
        const parsed = JSON.parse(src);
        const out = pretty
          ? JSON.stringify(parsed, null, INDENTS[this.indent])
          : JSON.stringify(parsed);
        this.lastParsed = parsed;
        this.renderTree(parsed, out, INITIAL_BUDGET);
      } catch (e) {
        this.showError(e);
      }
    },

    // 渲染整棵树：budget 限制初始展开行数，超出的容器折叠懒加载
    renderTree(parsed, outText, budget) {
      this.lastOutput = outText;
      this.lastParsed = parsed;
      const lazyArr = [];
      const moreArr = [];
      this.tree.innerHTML = this.buildNodeHTML(
        parsed, null, true, true, { left: budget }, lazyArr, moreArr
      );
      this._zipLazy(this.tree, lazyArr, moreArr);
      this.error.hidden = true;
      this.tree.hidden = false;
      this.tree.scrollTop = 0;
    },

    // innerHTML 之后按文档顺序把数据挂到懒节点上（构建顺序与文档顺序一致）
    _zipLazy(scope, lazyArr, moreArr) {
      const lazies = scope.querySelectorAll('.jt-lazy');
      for (let i = 0; i < lazies.length; i++) lazies[i]._lazy = lazyArr[i];
      const mores = scope.querySelectorAll('.jt-more');
      for (let i = 0; i < mores.length; i++) mores[i]._more = moreArr[i];
    },

    // 递归生成一个节点的 HTML
    buildNodeHTML(value, key, isLast, isRoot, ctx, lazyArr, moreArr) {
      if (!isContainer(value)) { // 叶子值
        ctx.left--;
        let h = '<div class="jt-line">';
        if (key !== null) h += keyHTML(key);
        h += valueHTML(value);
        if (!isLast) h += '<span class="jt-punct">,</span>';
        return h + '</div>';
      }

      const openCh = Array.isArray(value) ? '[' : '{';
      const closeCh = Array.isArray(value) ? ']' : '}';
      const entries = entriesOf(value);
      const head = (isRoot ? '' : '<span class="jt-arrow">' + App.icons.chevron + '</span>') +
        (key !== null ? keyHTML(key) : '') +
        '<span class="jt-punct">' + openCh + '</span>';

      if (entries.length === 0) { // 空对象 / 空数组：无箭头，收在一行
        ctx.left--;
        let h = '<div class="jt-line">';
        if (key !== null) h += keyHTML(key);
        h += '<span class="jt-punct">' + openCh + closeCh + '</span>';
        if (!isLast) h += '<span class="jt-punct">,</span>';
        return h + '</div>';
      }

      // 预算耗尽：渲染为折叠懒节点，首次展开时才构建子级
      if (!isRoot && ctx.left <= 0) {
        ctx.left--;
        lazyArr.push({ value, isLast });
        return '<div class="jt-node jt-lazy collapsed"><div class="jt-line">' + head +
          summaryHTML(closeCh, countOf(value), isLast) + '</div></div>';
      }

      ctx.left--;
      let h = '<div class="jt-node' + (isRoot ? ' jt-root' : '') + '">';
      h += '<div class="jt-line">' + head + summaryHTML(closeCh, countOf(value), isLast) + '</div>';
      h += '<div class="jt-children">';

      for (let idx = 0; idx < entries.length; idx++) {
        // 预算耗尽且后面还有项：生成「加载更多」占位行
        if (ctx.left <= 0 && idx < entries.length - 1) {
          h += this.moreHTML(value, idx, entries.length - idx, moreArr);
          return h + '</div>' +
            '<div class="jt-line jt-end"><span class="jt-punct">' + closeCh + '</span>' +
            (isLast ? '' : '<span class="jt-punct">,</span>') + '</div></div>';
        }
        h += this.buildNodeHTML(entries[idx][1], entries[idx][0], idx === entries.length - 1, false, ctx, lazyArr, moreArr);
      }

      h += '</div>';
      h += '<div class="jt-line jt-end"><span class="jt-punct">' + closeCh + '</span>' +
        (isLast ? '' : '<span class="jt-punct">,</span>') + '</div>';
      return h + '</div>';
    },

    // 「剩余 N 项」占位行，点击分批加载
    moreHTML(value, start, remaining, moreArr) {
      moreArr.push({ value, start });
      return '<div class="jt-line jt-more">… 剩余 ' + remaining + ' 项，点击展开</div>';
    },

    // 首次展开懒节点：构建其子级（子级里超出预算的部分同样懒加载）
    expandLazy(node) {
      const lazy = node._lazy;
      node._lazy = null;
      node.classList.remove('jt-lazy');
      if (!lazy) return;
      const ctx = { left: EXPAND_BUDGET };
      const lazyArr = [];
      const moreArr = [];
      const closeCh = Array.isArray(lazy.value) ? ']' : '}';
      const entries = entriesOf(lazy.value);
      let h = '<div class="jt-children">';
      for (let idx = 0; idx < entries.length; idx++) {
        h += this.buildNodeHTML(entries[idx][1], entries[idx][0], idx === entries.length - 1, false, ctx, lazyArr, moreArr);
      }
      h += '</div>';
      h += '<div class="jt-line jt-end"><span class="jt-punct">' + closeCh + '</span>' +
        (lazy.isLast ? '' : '<span class="jt-punct">,</span>') + '</div>';

      const tmp = document.createElement('div');
      tmp.innerHTML = h;
      this._zipLazy(tmp, lazyArr, moreArr);
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      node.appendChild(frag);
    },

    // 加载「剩余 N 项」的下一批
    loadMore(moreEl) {
      const d = moreEl._more;
      const entries = entriesOf(d.value);
      const ctx = { left: EXPAND_BUDGET };
      const lazyArr = [];
      const moreArr = [];
      let html = '';
      let idx = d.start;
      for (; idx < entries.length; idx++) {
        html += this.buildNodeHTML(entries[idx][1], entries[idx][0], idx === entries.length - 1, false, ctx, lazyArr, moreArr);
        if (ctx.left <= 0 && idx < entries.length - 1) { // 本批到此为止，剩余继续挂占位
          idx++;
          html += this.moreHTML(d.value, idx, entries.length - idx, moreArr);
          break;
        }
      }
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      this._zipLazy(tmp, lazyArr, moreArr);
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      moreEl.replaceWith(frag);
    },

    expandAll() {
      if (this.tree.hidden || !this.lastParsed) return;
      this.renderTree(this.lastParsed, this.lastOutput, Infinity);
    },

    collapseAll() {
      if (this.tree.hidden) return;
      const nodes = this.tree.querySelectorAll('.jt-node:not(.jt-lazy)');
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].querySelector(':scope > .jt-children')) nodes[i].classList.add('collapsed');
      }
    },

    showError(err) {
      this.tree.hidden = true;
      this.error.hidden = false;
      this.errMsg.textContent = err.message || String(err);
      this.errPos.textContent = err.line ? '第 ' + err.line + ' 行 · 第 ' + err.col + ' 列' : '';
      this.lastOutput = '';
    },

    showEmpty() {
      this.tree.hidden = true;
      this.error.hidden = true;
      this.lastOutput = '';
    },

    clearAll() {
      this.input.value = '';
      this.showEmpty();
      this.input.focus();
    }
  };

  App.registerTool('json', tool);
})();
