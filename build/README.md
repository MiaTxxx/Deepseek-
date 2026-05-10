# 构建资源

打包前把下面的图标文件放进这个目录：

- `icon.ico` — Windows 安装包图标（至少 256×256，推荐包含多尺寸）
- `icon.icns` — macOS 图标
- `icon.png` — Linux 图标（512×512 PNG）

**没有这些文件也能打包**，只是用 Electron 默认图标。

## 快速生成

如果你有一张 1024×1024 的 PNG：

- 在线工具：https://cloudconvert.com/png-to-ico （多选 16/32/48/64/128/256 尺寸）
- 或命令行（macOS 有 `iconutil`，Windows 用 `magick` / ImageMagick）
