# ClearWrite 安卓开发版

[English](README.md)

安卓 App 拥有**独立的手机端界面**（`apps/mobile`）。它不是桌面 Web 端的缩小版：布局系统、组件、导航与页面都按单手操作重新设计。**配色则沿用桌面端 ClearWrite 设计规范**——冷灰蓝底、白卡、深曜石黑主动作与品牌绿，深色模式由同一套色相推导（`apps/mobile/src/styles.css`）。不引入桌面端的 CSS 或组件，只共享色值与 Local Runtime 的 HTTP API，因此学习记录与模型设置和电脑端完全一致。

Java WebView 外壳（`apps/android`）通过 ADB 反向端口转发，加载电脑端 Local Runtime 提供的 `http://127.0.0.1:5173/mobile/`。使用 App 时，电脑需要保持 ClearWrite 运行。

## 功能

- **今天** — 待复习数量、快捷开始、近 7 天学习节奏、最近记录与连接状态。
- **写作** — 语法检查（修正 / 更自然的说法 / 原因 / 记忆点，保存到手册，追问转入问答）与表达转换（中英双向），支持粘贴、分享、复制、朗读与草稿自动保存。
- **提问** — 多轮用法问答、笔记保存与查看/删除、回答语言选择。
- **词汇** — 查词、词库（筛选与复习历史）、四档评分的间隔复习完整流程。
- **练习** — 中译英句子练习，难度/语体/场景筛选、三级渐进提示、作答评估与参考译文。
- **我的** — 学习概览与成长指标、可筛选的语法手册、学习教练报告与解释、已保存笔记。
- **设置** — 语言、主题、触觉反馈、模型配置、Markdown 路径与运行时状态。

移动端专属体验：五个底部入口（提问为凸起主操作）、沉浸式全屏模式、底部抽屉、下拉刷新、断线时显示上次缓存的学习数据、WebView 重载后仍保留的草稿、安全区适配、软键盘弹出时隐藏底栏、安卓返回键、跟随系统深色模式、原生触觉反馈与剪贴板、系统离线语音（失败时回退到 Runtime TTS）、屏幕常亮控制，以及从其他 App **分享到 ClearWrite**（`ACTION_SEND text/plain`）直接进入写作页。连接不上电脑端时显示原生连接提示页与 **重试** 按钮。

## 构建与运行

使用 PowerShell 7、JDK 17、Android SDK Platform 36、Build Tools 36.0.0 和 Platform Tools。将 `ANDROID_HOME` 指向 SDK 目录，并确保 PATH 中能找到 `adb`。App 支持 Android 8.0 及以上。

配置好项目的 `.env` 后，在仓库根目录执行：

```powershell
npm ci
npm run android:build
npm run client:build
npm run web:start
```

`npm run client:build` 会**同时构建两端**：桌面端输出到 `apps/web/dist/`，移动端输出到 `apps/web/dist/mobile/`。只执行 `web:build` 不够——它会清空 `dist/`，手机上就取不到 `/mobile/` 产物。保持服务绑定在 `127.0.0.1`，并记下启动信息中 `Ready on` 一行的端口。

连接已开启 USB 调试的手机并在手机上授权电脑，或启动安卓模拟器。另开一个终端执行：

```powershell
adb devices -l
adb install -r apps\android\build\ClearWrite-debug.apk
$clearWritePort = Read-Host 'ClearWrite Ready on 端口'
adb reverse tcp:5173 "tcp:$clearWritePort"
```

同时连接多台设备时，在安装和转发命令的 `adb` 后加上 `-s 设备序列号`。从应用列表打开 **ClearWrite**。设备重连后如果转发规则丢失，重新执行 `adb reverse`，再点 **重试**。安卓侧端口固定为 `5173`。

### 界面开发（免重复构建）

终端 1 启动 Local Runtime（API 端口为 `IGT_DEV_API_PORT`，默认 `18964`）和桌面端 Vite：

```powershell
npm run web:dev
```

终端 2 启动移动端 Vite（默认端口 `5174`，API 代理到 `18964`）：

```powershell
npm run mobile:dev
```

然后把转发目标指向移动端 Vite 端口：

```powershell
adb reverse tcp:5173 tcp:5174
```

可用 `.env` 中的 `IGT_MOBILE_PORT` / `IGT_DEV_API_PORT` 调整端口。前端改动会热更新；修改 Android 外壳代码仍需 `npm run android:build` 并重新安装 APK。

### 校验

```powershell
npm run mobile:typecheck
npm run test:mobile-app
```

`test:mobile-app` 校验 `/mobile/` 静态路由，并在 320/360/390/430 px 下渲染全部 12 个页面（无横向溢出、导航目标 ≥44px、WCAG 2.5.8 最小触控尺寸、输入框 16px 字号），同时检查深色模式、安全区、键盘、返回键、草稿恢复与系统分享桥接。全部使用模拟 API 数据，不访问数据库、不调用模型。

## 设备验证

确认 App 打开 **今天**，用底栏访问写作、提问、词汇、练习，用右上角头像进入「我的」与设置。检查安卓返回键能回到前一页、软键盘弹出时底栏隐藏、系统深色模式切换生效、从其他应用**分享到 ClearWrite** 后文本出现在写作输入框。关闭 App 后执行 `adb reverse --remove tcp:5173`，重新打开验证连接提示页，恢复转发后点 **重试**。APK 使用保存在构建目录中的本地调试签名密钥，构建目录已被 Git 忽略。
