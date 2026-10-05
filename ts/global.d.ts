/* ==========================================================================
 * global.d.ts — 跨文件共享的全局类型
 * 页面按经典 <script> 方式加载（保证 file:// 双击可用），因此类型走全局声明
 * ========================================================================== */

/** 工具定义：在 ts/ 下的工具文件里通过 App.registerTool(id, def) 注册 */
interface ToolDef {
  /** 菜单项与 document.title 显示的名称 */
  title: string;
  /** 渲染工具页面（App.init 时调用一次） */
  render(root: HTMLElement): void;
  /** 路由切换到该工具时调用（如启动时钟） */
  onShow?(): void;
  /** 离开该工具时调用（如停止时钟） */
  onHide?(): void;
}

/** 应用外壳，运行时由 app.ts 挂到 window.App */
interface AppApi {
  tools: Record<string, ToolDef>;
  /** 当前路由的工具 id */
  current: string | null;
  icons: Record<string, string>;
  registerTool(id: string, def: ToolDef): void;
  init(): void;
  initTheme(): void;
  applyTheme(theme: 'dark' | 'light', silent?: boolean): void;
  toggleTheme(): void;
  route(): void;
  toast(msg: string): void;
  copy(text: string): Promise<boolean>;
  bindCopy(btn: HTMLElement | null, getText: () => string, okMsg?: string): void;
  bindCopyRow(root: HTMLElement): void;
  escapeHtml(str: unknown): string;
  fmtBytes(n: number): string;
  byteLength(str: string): number;
  pad2(n: number): string;
  readonly WEEKDAYS: string[];
}

/** 懒节点首次展开时才构建子级，未展开前数据暂存在元素上（见 _zipLazy） */
interface LazyNodeData {
  value: unknown;
  isLast: boolean;
}

/** 「剩余 N 项」占位行的加载进度 */
interface MoreNodeData {
  value: unknown;
  start: number;
}

interface Element {
  _lazy?: LazyNodeData | null;
  _more?: MoreNodeData | null;
}

interface Window {
  App: AppApi;
}

/** 经典 script 共享的全局 App（app.ts 启动时挂载，工具文件直接引用） */
declare const App: AppApi;
