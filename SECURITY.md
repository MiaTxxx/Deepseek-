# 安全与隐私说明

## 数据流向

| 数据 | 去向 | 存储位置 |
|---|---|---|
| API Key | 仅发往 `https://api.deepseek.com/user/balance` | 本地 `electron-store`（加密）|
| 平台登录 Cookie | 仅发往 `https://platform.deepseek.com` | Electron 会话分区 `persist:deepseek` |
| 用量数据 | 拉取后仅在内存 + 窗口渲染 | 不落盘 |

**本项目没有任何自建后端、遥测、埋点或第三方上报。** 你可以全文搜索代码，找不到除 `api.deepseek.com`、`platform.deepseek.com` 之外的出站请求。

## 存储文件位置

- Windows: `%APPDATA%/DeepSeek Monitor/`
- macOS: `~/Library/Application Support/DeepSeek Monitor/`
- Linux: `~/.config/DeepSeek Monitor/`

这些文件**不在 Git 仓库里**（`.gitignore` 已排除），且仅存在于运行应用的用户机器上。

## 多用户隔离

每个用户运行的是自己本机的副本，彼此数据互不可见。克隆/fork 本仓库只得到源代码，不会得到任何人的 Key 或 Cookie。

## 报告漏洞

如果你发现安全问题，请通过 GitHub Issue 或私信联系维护者。请**不要**在公开 Issue 中贴出完整的 API Key 或 Cookie。
