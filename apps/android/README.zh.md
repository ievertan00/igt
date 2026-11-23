# ClearWrite 安卓开发版

[English](README.md)

安卓 App 使用独立的手机布局。底栏提供写作、词汇、练习、问答和学习五个入口，写作和词汇的子功能通过页面内的标签切换。App 通过 WebView 运行，并通过 ADB 反向端口转发连接 Windows 上的 Local Runtime。学习数据和模型设置与电脑端共用。使用 App 时，电脑需要保持 ClearWrite 运行。

## 构建与运行

使用 PowerShell 7、JDK 17、Android SDK Platform 36、Build Tools 36.0.0 和 Platform Tools。将 `ANDROID_HOME` 指向 SDK 目录，并确保 PATH 中能找到 `adb`。App 支持 Android 8.0 及以上。

配置好项目的 `.env` 后，在仓库根目录执行：

```powershell
npm run android:build
npm run web:build
npm run web:start
```

将运行服务保持在 `127.0.0.1`。连接已开启 USB 调试的手机并在手机上授权电脑，或者启动安卓模拟器。另开一个终端执行以下命令，输入电脑服务在 `Ready on` 一行显示的端口：

```powershell
adb devices -l
adb install -r apps\android\build\ClearWrite-debug.apk
$clearWritePort = Read-Host 'ClearWrite Ready on 端口'
adb reverse tcp:5173 "tcp:$clearWritePort"
```

同时连接多台设备时，在安装和转发命令的 `adb` 后加上 `-s 设备序列号`。从手机的应用列表打开 **ClearWrite**。设备重连后如果转发规则丢失，重新执行 `adb reverse`，再点 **重试**。

使用 Vite 开发时，把转发目标设为 `npm run web:dev` 打印的 Web 端口。两种方式的安卓端端口均为 `5173`。通过 `npm run web:start` 运行时，修改前端代码后需要重新构建 Web 客户端。修改 Android 代码后需要重新构建并安装 APK。

## 设备验证

确认 App 打开语法检查页，再从底栏访问词汇、练习、问答和学习记录。检查安卓返回键能回到前一页，软键盘弹出时底栏会隐藏。关闭 App 后执行 `adb reverse --remove tcp:5173`，重新打开 App 验证断线提示。恢复转发后点 **重试**。APK 使用保存在构建目录中的本地调试签名密钥，构建目录已被 Git 忽略。
