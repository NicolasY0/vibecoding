# Bilibili Dynamic Deleter 🗑️

一键清空 B 站全部动态。基于 API 驱动，不依赖 DOM 点击，不怕 B 站改 UI。

## 快速开始

### 安装

```bash
npx skills add https://github.com/NicolasY0/bilibili-dynamic-deleter
```

### 使用

```bash
node .agents/skills/bilibili-dynamic-deleter/scripts/run.js <你的B站UID>
```

如果你不知道自己的 UID，打开 [space.bilibili.com](https://space.bilibili.com/)，地址栏里的数字就是。

### 发生了什么

1. 自动打开 Chrome 浏览器
2. 如果你没登录 B 站，显示二维码让你扫
3. 登录后自动获取你的全部动态
4. 通过 B 站内部 API 逐条删除（带自适应限流保护）
5. 完成后自动关闭浏览器

## 为什么比 DOM 点击方案好

| 方案 | 速度 | 稳定性 | 限流处理 |
|------|------|--------|----------|
| DOM 模拟点击 | ~1.5s/条 | CSS 变了就坏 | ❌ 操作过快被封 |
| **API 直驱 (本方案)** | ~0.06s/条 | 接口稳定 | ✅ 429/412 自适应退避 |

## 手动使用

如果你不想用自动化，也可以手动跑脚本：

1. 打开 `https://space.bilibili.com/你的UID/dynamic`
2. F12 → Console
3. 粘贴 [`scripts/delete.js`](scripts/delete.js) 的内容
4. 回车

刷新页面即可终止。

## 技术原理

调用 B 站自身使用的内部 API：

| 接口 | 方法 | 用途 |
|------|------|------|
| `api.bilibili.com/x/polymer/web-dynamic/v1/feed/space` | GET | 获取动态列表 |
| `api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic` | POST | 删除单条动态 |

CSRF Token 从浏览器 Cookie 的 `bili_jct` 字段获取。

## 常见错误

| 现象 | 原因 | 解决 |
|------|------|------|
| `NOT_LOGGED_IN` | Cookie 中没有 `bili_jct` | 先手动登录一次 B 站 |
| 删除 0 条 | 所有动态已清空 | 恭喜 🎉 |
| IP 被封 (412) | 请求太频繁 | 等几分钟再试 |
| 操作太快 (429) | 脚本自动降速 | 自动处理，不用管 |

## License

MIT
