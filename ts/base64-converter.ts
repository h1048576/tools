/* ==========================================================================
 * base64-converter.ts — 字符串 ↔ Base64 格式转换
 * 使用 UTF-8 编码支持中文及其他 Unicode 文本
 * 编译为 js/base64-converter.js（npm run build），请勿直接改 js/ 下的产物
 * ========================================================================== */
(function () {
  'use strict';

  function encodeBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function decodeBase64(text: string): string {
    const binary = atob(text.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  const tool = {
    title: '格式转换',
    input: null as unknown as HTMLTextAreaElement,
    output: null as unknown as HTMLTextAreaElement,
    decodeButton: null as unknown as HTMLButtonElement,
    encodeButton: null as unknown as HTMLButtonElement,

    render(root: HTMLElement): void {
      root.innerHTML = `
        <header class="tool-header">
          <div><h1 class="tool-title">格式转换</h1></div>
          <span class="badge-pill">本地运行</span>
        </header>

        <div class="convert-layout">
          <section class="convert-pane">
            <div class="pane-head"><label class="pane-title" for="convertInput">原字符串</label></div>
            <textarea id="convertInput" class="convert-textarea" spellcheck="false" wrap="off"
              placeholder="输入要转换的字符串" aria-label="原字符串输入框"></textarea>
          </section>

          <div class="convert-toolbar" role="group" aria-label="转换工具">
            <button type="button" id="btnBase64ToString" class="btn btn-secondary" aria-pressed="false">Base64ToString</button>
            <button type="button" id="btnStringToBase64" class="btn btn-secondary" aria-pressed="false">StringToBase64</button>
          </div>

          <section class="convert-pane">
            <div class="pane-head"><label class="pane-title" for="convertOutput">转换结果</label></div>
            <textarea id="convertOutput" class="convert-textarea" readonly spellcheck="false" wrap="off"
              placeholder="转换后的内容将显示在这里" aria-label="字符串输出框"></textarea>
          </section>
        </div>`;

      this.input = root.querySelector<HTMLTextAreaElement>('#convertInput')!;
      this.output = root.querySelector<HTMLTextAreaElement>('#convertOutput')!;

      this.decodeButton = root.querySelector<HTMLButtonElement>('#btnBase64ToString')!;
      this.encodeButton = root.querySelector<HTMLButtonElement>('#btnStringToBase64')!;
      this.decodeButton.addEventListener('click', () => {
        this.selectDirection('decode');
        this.convert('decode');
      });
      this.encodeButton.addEventListener('click', () => {
        this.selectDirection('encode');
        this.convert('encode');
      });
    },

    selectDirection(direction: 'encode' | 'decode'): void {
      const decodeSelected = direction === 'decode';
      this.decodeButton.classList.toggle('is-selected', decodeSelected);
      this.encodeButton.classList.toggle('is-selected', !decodeSelected);
      this.decodeButton.setAttribute('aria-pressed', String(decodeSelected));
      this.encodeButton.setAttribute('aria-pressed', String(!decodeSelected));
    },

    convert(direction: 'encode' | 'decode'): void {
      const source = this.input.value;
      if (!source) {
        this.output.value = '';
        return;
      }

      try {
        this.output.value = direction === 'encode' ? encodeBase64(source) : decodeBase64(source);
        this.output.scrollTop = 0;
        this.output.scrollLeft = 0;
      } catch {
        this.output.value = '';
        App.toast(direction === 'decode'
          ? '无法转换：请输入有效的 Base64 UTF-8 内容'
          : '转换失败，请检查输入内容');
      }
    }
  };

  App.registerTool('convert', tool);
})();
