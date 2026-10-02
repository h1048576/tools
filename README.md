# 工具集

纯前端开发工具集，所有计算均在浏览器本地完成，无任何后端与网络请求（仅字体走 CDN）。

## 包含工具

- **JSON 格式化** — 校验（报错定位到行/列）、美化（2/4 空格、Tab 缩进）、压缩、可折叠树形输出，`Ctrl + Enter` 快速格式化
- **时间戳转换** — 实时时钟、Unix 时间戳 ↔ 日期双向转换（秒/毫秒自动识别）、ISO 8601、相对时间

## 使用方式

无需构建，任选其一：

1. 直接双击打开 `index.html`；
2. 或起本地服务器：`python server.py` 后访问 <http://localhost:8642>。

`server.py` 是带 `Cache-Control: no-cache` 头的开发服务器——改了 CSS/JS 后普通刷新即可看到最新版（Windows 自带的 `python -m http.server` 会启发式缓存，可能需要 Ctrl+F5）。

## 目录结构

```
index.html                  页面骨架（侧边菜单 + 工作区）
css/style.css               设计体系（基于 DESIGN-CLAUDE.md 的 token）
js/app.js                   应用外壳：hash 路由、菜单、复制、吐司、图标
js/json-formatter.js        JSON 格式化工具
js/timestamp-converter.js   时间戳转换工具
```

## 新增工具

在 `js/` 下新建文件，调用 `App.registerTool(id, def)` 注册（`def.render(container)` 负责渲染自身页面），然后在 `index.html` 的侧边菜单里加一个 `href="#<id>"` 的菜单项即可，路由与菜单高亮自动生效。

## 设计体系

视觉基于 `C:\Users\AD86\design\DESIGN-CLAUDE.md`（暖奶油画布 + 珊瑚主色 + 深色代码面板；衬线展示标题 + 人文无衬线正文）。字体使用开源近似替代：Cormorant Garamond / Noto Serif SC（展示）、Inter（正文）、JetBrains Mono（代码）。
