# Claude Code 工作记录

## 项目环境

- **OS**: Windows 11 Home China
- **Shell**: Git Bash
- **包管理**: npm (Node.js), uv (Python)
- **浏览器自动化**: Puppeteer-core（CDP 稳定），agent-browser（Windows 上 CDP 不可靠）

## 2026-07-22：B 站动态批量删除 Skill 开发

### 做了什么

开发了一个自包含的 Claude Code Skill，能够自动删除 B 站全部动态。最终方案：

1. **Tampermonkey 脚本** — 可视化面板，按类型/点赞/关键词选择性删除
2. **Console 脚本** — F12 贴入即用
3. **Puppeteer 自动化脚本** — `node run.js UID` 完全自动（打开 Chrome → 扫码登录 → 删除 → 退出）

仓库：[NicolasY0/bilibili-dynamic-deleter](https://github.com/NicolasY0/bilibili-dynamic-deleter)

### 核心教训

#### 1. 网站自动化：API > JS 注入 > DOM 操作

```
选方案的正确优先级：
  1. 直接调网站 API（最快、最稳）
  2. 注入 JS 脚本到页面（快，不走 CDP 往返）
  3. 浏览器自动化点 DOM（最慢、最脆弱）
```

不要一上来就用浏览器自动化。先 F12 → Network 看网站自己用什么 API，能调 API 就调 API。

#### 2. 先侦察再开工

任何网站自动化之前：
- F12 → Network 看一遍 API 调用
- F12 → Elements 看事件绑定（`mouseenter` 还是 `click`？）
- 搜一下 Greasyfork/Tampermonkey 有没有现成脚本

这次踩的坑：B 站菜单是 `mouseenter` 触发的，不是 `click`，花了大量时间用错事件类型。

#### 3. 三次失败 = 换方案

同一个方案连续失败 3 次，强制停下来重新评估。不要不断调参数（加 sleep、减 sleep、换重试间隔），问题很可能是方案本身就错了。

这次 agent-browser 的 click/snapshot 循环失败了 6+ 次，杀了 60+ 个 Chrome 进程，才意识到应该用 API。

#### 4. agent-browser 在 Windows 上不可靠

CDP WebSocket 连接持续超时（os error 10060）。替代方案：
- **Puppeteer-core** + 已有 Chrome → CDP 连接稳定
- 或者直接让用户在浏览器 Console 里跑脚本

#### 4. 「跑通了」≠「方案对了」

v2 的 DOM 点击脚本删了 789 条，看似在工作。但它慢、脆弱、频繁触发限流。当时看到能跑就没再想优化，其实应该追问「这是最快的吗？还能更稳吗？」最终 API 方案提了 25 倍速度。

**教训**：能跑只是及格线。问自己「能不能再简单一个数量级？」

#### 5. 别对工具有感情

agent-browser 用久了就不想换，每次失败都觉得「再调调就行」。杀了 68 个进程、写了 4 版脚本才放手。正确的态度是：这轮不好使就换，刻不容缓。

**教训**：工具是消耗品，方案不对立刻扔。不要因为已经投入了时间就舍不得。

#### 6. 先验证一个，再写循环

应该先手动跑一遍「mouseenter → 找删除选项 → 点确认」这个链路，验证每一步的选择器都对。但我直接写了个 while 循环，等跑了 789 轮才发现删除按钮根本没点到。

**教训**：循环之前，先让一步跑通。

#### 7. Skill 要做成自包含的

别人 `npx skills add` 之后应该能直接用，不需要再手动安装 Tampermonkey 或其他工具。

### 技术笔记

**B 站动态删除 API**：
| 接口 | 方法 |
|------|------|
| `api.bilibili.com/x/polymer/web-dynamic/v1/feed/space` | GET 动态列表（新版） |
| `api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history` | GET 动态列表（旧版回退） |
| `api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic` | POST 删除 |

CSRF Token 来源：Cookie `bili_jct`

**B 站动态类型编号**：
| 转发 | 图文 | 视频 | 小视频 | 专栏 | 音乐 | 直播 |
|------|------|------|--------|------|------|------|
| 1 | 2 | 8 | 16 | 64 | 256 | 4200 |

**Puppeteer-core 连接已有 Chrome**：
```js
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223' });
```
需要先启动 Chrome：`chrome.exe --remote-debugging-port=9223`

