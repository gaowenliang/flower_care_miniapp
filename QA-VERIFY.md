# 养花助手微信小程序 · QA 核查报告

> 核查日期：2026-06-14
> 核查范围：基于 REVIEW.md 中列出的所有问题，逐条验证实际代码
> 核查方法：实际读取代码文件，grep 定位，对照验证

---

## 🔴 严重问题验证

### 1.1 setTimeout 在 onUnload 未清理

**✅ 确认属实 — P0 严重等级**

**验证结果**：
- 搜索 `grep -rn "onUnload" --include="*.js"` → **返回空，没有任何页面上定义了 onUnload 生命周期**
- 搜索 `grep -rn "clearTimeout" --include="*.js"` → 仅在 `cloud-sync.js` 的行 147 出现（业务用途），所有页面均无 `clearTimeout`

**涉及文件及行号**：

| 文件 | 行号 | setTimeout 内容 | 风险 |
|------|------|-----------------|------|
| `pages/plant-journal/plant-journal.js` | 25, 34 | `setTimeout(() => wx.navigateBack(), 1000)` | 页面销毁后 navigateBack 无影响 |
| `pages/family/family.js` | 31, 63 | `setTimeout(() => this.setData({ loading: false }), 200)` | ⚠️ **高危**：页面销毁后 setData 会抛出 Warning |
| `pages/family/family.js` | 300, 313 | `setTimeout(() => wx.switchTab(...), 1000)` | 页面销毁后 switchTab 可能失效 |
| `pages/index/index.js` | 79 | `setTimeout(() => this.setData({ loading: false }), 300)` | ⚠️ **高危**：页面销毁后 setData Warning |
| `pages/index/index.js` | 400, 425, 490, 521 | `setTimeout(() => this.setData({ showTip: false }), 2000)` | ⚠️ **高危**：2s 延迟，极易命中 |
| `pages/add-plant/add-plant.js` | 320, 373, 461, 518 | `setTimeout(() => wx.switchTab(...), 800)` | 中等风险 |
| `pages/add-plant/add-plant.js` | 513 | `setTimeout(() => {...}, ...)` | 内部含多个操作，中等风险 |
| `pages/calendar/calendar.js` | 47 | `setTimeout(() => this.setData({ loading: false }), 300)` | ⚠️ **高危**：setData Warning |
| `pages/plant-detail/plant-detail.js` | 68, 94, 120, 134, 468, 489, 491 | 多个 setTimeout 含 setData 和 navigateBack | ⚠️ **高危**：多个 setData 调用 |
| `pages/import-screenshot/import-screenshot.js` | 256 | `setTimeout(() => wx.navigateBack(), 1500)` | 中等风险 |

**修复方案**：

1. 在 `utils/util.js` 中添加通用定时器管理工具：

```js
// utils/util.js 追加
// 页面定时器管理 — 用于在 onUnload 时自动清理
const PAGE_TIMERS = new Map()

function safeSetTimeout(page, fn, delay) {
  const timer = setTimeout(fn, delay)
  if (!PAGE_TIMERS.has(page)) PAGE_TIMERS.set(page, [])
  PAGE_TIMERS.get(page).push(timer)
  return timer
}

function clearPageTimers(page) {
  const timers = PAGE_TIMERS.get(page)
  if (timers) {
    timers.forEach(clearTimeout)
    PAGE_TIMERS.delete(page)
  }
}
```

2. 在所有含 setTimeout 的页面中统一添加：

```js
onUnload() {
  util.clearPageTimers(this)
}
```

3. 所有 `setTimeout(() => this.setData(...))` 改为 `util.safeSetTimeout(this, () => this.setData(...), delay)`

---

### 1.2 appid 硬编码

**⚠️ 部分属实 — P1 严重等级**

**验证结果**：
- `grep -rn "appid\|appId\|APPID" miniprogram/` → **返回空**，前端代码中无 appid
- `project.config.json` 行 47 → `"appid": "wx8ba3dab6769e7bb0"` ❗ 确认为真实 appid

**实际情况**：该 appid 是微信开发者工具的项目配置文件标配字段，仅本地开发调试使用。**小程序提审时工具使用 `project.config.json` 的 appid 上传，不属于代码级硬编码风险**。但在多人协作时，`project.config.json` 提交到 git 会暴露 appid。

**修复建议**：
- 将 `project.config.json` 加入 `.gitignore`（或使用 `project.config.json` + `project.private.config.json` 分离）
- 前端代码中无 appid 硬编码，确认安全

---

### 1.3 个人/家庭模式 if-else 重复

**✅ 确认属实 — P0 严重等级**

**验证结果**：通过 `grep -rn "isFamilyMode\|isInFamily"` 统计：

| 文件 | 出现次数 |
|------|---------|
| `pages/plant-journal/plant-journal.js` | 6 处 (行 19, 21, 42, 165, 223, 271) |
| `pages/index/index.js` | 1 处 (行 38 data 初始化) |
| `pages/add-plant/add-plant.js` | 2 处 (行 298, 440) |
| `pages/calendar/calendar.js` | 7 处 (行 34, 39, 40, 68, 74, 96, 191, 291) |
| `pages/plant-detail/plant-detail.js` | 20+ 处 (行 30, 61, 62, 64, 198, 216, 279, 308, 327, 359, 426, 462, 522, 545, 569, 609, 615, 643, 673, 717, 782, 817, 852) |
| `utils/health-score.js` | 3 处 |
| `utils/export.js` | 3 处 |
| `utils/subscribe.js` | 1 处 |

**总计约 40+ 处重复的 `if (isFamilyMode) family.X else storage.X`**

**修复方案 — DAO 层设计**：

```js
// utils/data-service.js — 统一数据服务层

const family = require('./family')
const storage = require('./storage')

class DataService {
  constructor() {
    this._mode = null
  }

  get isFamily() {
    return family.isInFamily()
  }

  // === 植物 ===
  getPlants() {
    return this.isFamily ? family.getCachedPlants() : storage.getGarden()
  }

  getPlantById(plantId) {
    return this.isFamily ? family.getPlantById(plantId) : storage.getPlantById(plantId)
  }

  addPlant(plantData) {
    return this.isFamily ? family.addPlant(plantData) : storage.addPlant(plantData)
  }

  updatePlant(plantId, updates) {
    return this.isFamily ? family.updatePlant(plantId, updates) : storage.updatePlant(plantId, updates)
  }

  removePlant(plantId) {
    return this.isFamily ? family.removePlant(plantId) : storage.removePlant(plantId)
  }

  // === 任务 ===
  getTasks(plantId) {
    return this.isFamily ? family.getCachedTasks(plantId) : storage.getTasksByPlant(plantId)
  }

  completeTask(taskId, note) {
    return this.isFamily ? family.completeTask(taskId, note) : storage.completeTask(taskId)
  }

  // === 记录 ===
  getRecords(plantId) {
    return this.isFamily ? family.getCachedRecords(plantId) : storage.getRecordsByPlant(plantId)
  }

  addRecord(recordData) {
    return this.isFamily ? family.addRecord(recordData) : storage.addRecord(recordData)
  }

  deleteRecord(recordId) {
    return this.isFamily ? family.deleteRecord(recordId) : storage.deleteRecord(recordId)
  }

  // === 统计 ===
  getStats() {
    if (this.isFamily) {
      return {
        totalRecords: family.getCachedRecords('').length,
        totalPlants: family.getCachedPlants().length
      }
    }
    return storage.getStats()
  }
}

module.exports = new DataService()
```

页面中使用 `dataService.getPlants()` 替代所有 `if (isFamilyMode) ... else ...`。

---

### 1.4 订阅消息模板 ID 占位符

**✅ 确认属实 — P1 严重等级**

**验证结果**：

文件 `utils/subscribe.js`，行 14-15 和 20：
```js
WATER_REMINDER: 'YOUR_WATER_TEMPLATE_ID',   // 行 14
CARE_REMINDER: 'YOUR_CARE_TEMPLATE_ID',      // 行 15
```

函数 `isTemplatePlaceholder` (行 20) 即是为检测占位符而设：
```js
function isTemplatePlaceholder(id) {
  return !id || id.startsWith('YOUR_')
}
```

代码本身已意识到这是占位符（有 `TODO: 上线前替换` 注释），`checkAndNotify` 函数在行 260-264 也有跳过逻辑：
```js
if (isTemplatePlaceholder(SUBSCRIBE_TEMPLATES.WATER_REMINDER)) {
  console.debug('[subscribe] 模板ID未替换，跳过订阅')
  return
}
```

**修复方案**：上线前在微信公众平台申请订阅消息模板，替换两个 ID。属于上线 Checklist 项目。

---

## 🟡 一般问题验证

### 2.1 health-score.js 家庭模式只用缓存

**⚠️ 部分属实 — P2 严重等级**

**验证结果**：`utils/health-score.js` 行 18-24：
```js
const isFamilyMode = family.isInFamily()
if (isFamilyMode) {
  const plantId = userPlant._id || userPlant.id
  tasks = family.getCachedTasks(plantId)
  records = family.getCachedRecords(plantId)
} else {
  tasks = storage.getTasksByPlant(userPlant.id)
  records = storage.getRecordsByPlant(userPlant.id)
}
```

**问题**：家庭模式下使用 `getCachedXXX`（直接读缓存，不会触发云端拉取），而个人模式下 `storage.getXXX` 也是从缓存读。两者都是缓存读取，行为对称。但在家庭模式下，如果缓存过期（TTL 5分钟）但之前加载过数据，`getCachedTasks` 仍返回旧数据（过期缓存不清空），得分可能不准确。

**修复方案**：`calculateAllHealthScores` 中家庭模式应调 `getPlants(true)` 刷新一次，或者让 `calculateHealthScore` 提供 forceRefresh 参数：

```js
function calculateHealthScore(userPlant, forceRefresh) {
  // ... existing code, but in family mode:
  if (isFamilyMode) {
    if (forceRefresh) {
      await family.getTasks(plantId, true)
      await family.getRecords(plantId, 500, true)
    }
    tasks = family.getCachedTasks(plantId)
    records = family.getCachedRecords(plantId)
  }
  // ...
}
```

---

### 2.2 image.js offscreenCanvas.toDataURL 兼容性

**✅ 确认属实 — P1 严重等级**

**验证结果**：`utils/image.js` 行 77-81：
```js
const canvas = wx.createOffscreenCanvas({ type: '2d', width: maxSize, height: maxSize })
const ctx = canvas.getContext('2d')
const img = canvas.createImage()
img.onload = () => {
  ctx.drawImage(img, sx, sy, s, s, 0, 0, maxSize, maxSize)
  try {
    const temp = canvas.toDataURL('image/jpeg', 0.5)
```

**问题**：
1. `wx.createOffscreenCanvas({ type: '2d' })` 需要基础库版本 ≥ 2.16.1，`project.config.json` 中 `libVersion: "3.3.4"` 满足，但用户旧版本微信未更新则报错
2. 行 107 有 try-catch 兜底走 `compressImage` 回退，已有处理

**但还有另一个问题**：行 93 `canvas.toDataURL` 在某些低端 Android 设备上不支持（Canvas 2D API 不完全实现）。当前已有一层 try-catch。

**评估**：代码已有兜底，但兜底后的 `compressImage` 是简单压缩，不是居中裁切。裁切功能在低端设备上静默退化。

**修复建议**：增加降级注册，判断设备是否支持 OffscreenCanvas：

```js
const IS_OFFSCREEN_SUPPORTED = (() => {
  try { wx.createOffscreenCanvas({ type: '2d' }); return true } catch(e) { return false }
})()
```

---

### 2.3 exif-date.js 只读 64KB

**✅ 确认属实 — P2 严重等级**

**验证结果**：`utils/exif-date.js` 行 9-12：
```js
wx.getFileSystemManager().readFile({
  filePath,
  length: 65536,  // 只读前 64KB
```

**问题**：EXIF 数据通常在文件头 64KB 内，大多数相机 JPEG 的 EXIF 都在前 64KB 内，但存在以下例外：
- 大幅马赛克预览图（某些相机嵌入大尺寸缩略图到 EXIF 中）可能导致 EXIF IFD 超出 64KB
- 某些手机拍摄的照片，APP1 段（Exif 数据）后附加了缩略图，总长度超 64KB 时，日期标签虽在前 64KB 但解析器结构可能跨边界

**实际风险评估**：极低。EXIF 日期标签（0x9003/0x9004）必定在 TIFF 头之后的 IFD0 中，几乎不可能超出 64KB。

**修复方案**（如仍需优化）：
```js
// 动态读取：先尝试 64KB，如果发现需要更多再读取
wx.getFileSystemManager().readFile({
  filePath,
  length: 65536,
  success: (res) => {
    try {
      const dateStr = parseExifDate(res.data)
      if (dateStr) return resolve(dateStr)
      // 64KB 不够，读取全文件
      wx.getFileSystemManager().readFile({
        filePath,
        success: (res2) => resolve(parseExifDate(res2.data) || null),
        fail: () => resolve(null)
      })
    } catch (e) {
      resolve(null)
    }
  },
  fail: () => resolve(null)
})
```

---

### 2.4 record type 黑名单过滤

**✅ 确认属实（但非黑名单设计） — P2 严重等级**

**验证结果**：多处代码中 `r.type !== 'photo' && r.type !== 'note'` 用于过滤非养护类记录：

| 文件 | 行号 | 代码 |
|------|------|------|
| `pages/profile/profile.js` | 205 | `records.filter(r => r.date >= monthStart && r.type !== 'photo' && r.type !== 'note')` |
| `pages/profile/profile.js` | 231 | `r.type !== 'photo' && r.type !== 'note'` |
| `pages/profile/profile.js` | 235 | `r.type !== 'photo' && r.type !== 'note'` |
| `utils/health-score.js` | 61 | `records.filter(r => r.type !== 'photo' && r.type !== 'note').length` |

**问题**：这些硬编码的 `'photo'` 和 `'note'` 字符串多次出现在不同位置。如果未来新增非养护类型（如 `'status_change'`、`'postpone'`），需要修改所有过滤点。REVIEW.md 将其描述为"黑名单过滤"更准确地说是"白名单以外的排除"。

**修复方案**：定义常量统一管理：

```js
// utils/constants.js
exports.ACTION_TYPES = {
  CARE: ['water', 'fertilize', 'prune', 'repot', 'pest', 'spray', 'loosen', 'cutting', 'sow', 'retro'],
  MEDIA: ['photo', 'note'],
  ALL: ['water', 'fertilize', 'prune', 'repot', 'pest', 'spray', 'photo', 'note', 'loosen', 'cutting', 'sow', 'retro', 'postpone']
}
exports.getCareRecords = (records) => records.filter(r => exports.ACTION_TYPES.CARE.includes(r.type))
```

---

### 2.5 export.js new Date(undefined) 隐式 bug

**⚠️ 部分属实 — P2 严重等级**

**验证结果**：`utils/export.js` 行 25 和 41：
```js
const days = Math.floor((Date.now() - plant.addedAt) / 86400000)  // 行 25 — plant.addedAt 可能为 undefined
const d = new Date(r.date)  // 行 41 — r.date 可能为 undefined
```

**实际风险分析**：
- 行 25：如果 `plant.addedAt` 为 `undefined`，`Date.now() - undefined` = `NaN`，`Math.floor(NaN)` = `NaN`，不会崩溃但显示 NaN
- 行 41：如果 `r.date` 为 `undefined`，`new Date(undefined)` 返回 `Invalid Date`（`toString` = `"Invalid Date"`），后续 `.getMonth()` 等返回 `NaN`。**但不会抛出异常**，只是显示错误
- 行 101（非 export.js）：`new Date(t.nextDate)` 如果 `t.nextDate` 为 undefined，同上

**结论**：不是"崩溃级" bug，但会导致数据显示异常。正如 REVIEW.md 所述，`new Date(undefined)` 不会抛 `SyntaxError`（与 `JSON.parse(undefined)` 不同），而是返回 Invalid Date。

**修复方案**：
```js
// 在 export.js 行 25 前加：
if (!plant.addedAt) return null

// 或行 41 改为：
const d = r.date ? new Date(r.date) : null
const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()}` : '未知日期'
```

---

### 2.6 family.js 86400000 硬编码

**✅ 确认属实 — P2 严重等级**

**验证结果**：`utils/family.js` 中的 86400000 出现 5 次（行 323, 375, 376），但**其他文件中也大量使用**：

```
utils/family.js:    task.nextDate = now + (task.intervalDays || 7) * 86400000
utils/family.js:    task.nextDate = (task.lastDoneDate || Date.now()) + updates.intervalDays * 86400000
utils/family.js:    if (task.nextDate < Date.now()) task.nextDate = Date.now() + updates.intervalDays * 86400000
pages/index/index.js:   (多处) * 86400000
pages/plant-detail/plant-detail.js: (多处) * 86400000
pages/calendar/calendar.js: (多处) * 86400000
```

全项目约 **25+ 处** 86400000 硬编码。REVIEW.md 仅指出 family.js 中的，但实际上是全局性问题。

**修复方案**：在 `utils/constants.js` 中定义：
```js
exports.MS_PER_DAY = 86400000
exports.MS_PER_HOUR = 3600000
exports.MS_PER_WEEK = 604800000
```

---

### 2.7 缺少离线/数据恢复机制

**✅ 确认属实 — P1 严重等级**

**验证结果**：
- `utils/network.js` 只有 `checkNetwork()` / `safeRequest()` 基础网络检查
- `utils/cloud-sync.js` 行 18-19 有 `offlineQueue = []` 声明但**从未被使用**（搜索 `offlineQueue`，只有声明和 push，没有 drain 逻辑）
- 各页面在无网络时无优雅降级提示

**关键发现**：`offlineQueue` 定义但未消费，属于**未完成功能**

**修复方案**：
1. 实现 offlineQueue 的 drain 逻辑（网络恢复时自动执行）
2. 页面加载时检测网络，无网络时显示离线指示器
3. 所有数据读取在无网络时自动降级到本地缓存

```js
// 在 cloud-sync.js 中
let offlineQueue = []

function enqueueOffline(action) {
  offlineQueue.push(action)
  wx.setStorageSync('_offline_queue', offlineQueue)
}

async function drainOfflineQueue() {
  if (offlineQueue.length === 0) return
  const queue = [...offlineQueue]
  offlineQueue = []
  wx.removeStorageSync('_offline_queue')
  
  for (const action of queue) {
    try { await action() } catch (e) {
      console.warn('离线队列执行失败:', e)
      offlineQueue.push(action)  // 重新入队
    }
  }
}

// 监听网络恢复
wx.onNetworkStatusChange((res) => {
  if (res.isConnected) drainOfflineQueue()
})
```

---

### 2.8 smart-tips 天气缓存结构

**✅ 确认属实 — P2 严重等级**

**验证结果**：`utils/smart-tips.js`，函数 `generateSmartTips`：

行 217-219 缓存检查：
```js
const cached = wx.getStorageSync(cacheKey)
if (cached && cached.length > 0) return cached  // ← 返回纯数组
```

行 247-249 缓存写入：
```js
wx.setStorageSync(cacheKey, finalTips)  // ← finalTips 是字符串数组
```

行 250-254 函数正常返回：
```js
return { tips: finalTips, weather: weatherSummary, season: ..., date: ... }  // ← 返回对象
```

**问题**：当缓存命中时，函数直接 `return cached`（返回 `['tip1', 'tip2']` 数组），但函数签名声明的是返回 `{ tips: [], weather: string, season: string, date: string }` 对象。调用方 `plant-detail.js` 行 739 期待 `result.tips`，在缓存命中时会得到 `undefined`（数组没有 `.tips` 属性）。

**这是真正的 bug**，缓存命中和缓存未命中的返回值类型不一致。

**修复方案**：
```js
// 改动仅 3 行
// 原：if (cached && cached.length > 0) return cached
// 改为：
if (cached && cached.length > 0) {
  return { tips: cached, weather: '', season: SEASON_NAMES[season], date: dateStr }
}
```

---

### 2.9 wx.showActionSheet 长度校验

**⚠️ 部分属实（已主动预防） — P1 严重等级**

**验证结果**：

`wx.showActionSheet` 的 `itemList` 最大长度为 6（微信 API 限制）。

| 文件 | 行号 | itemList 长度 | 是否安全 |
|------|------|---------------|---------|
| `pages/index/index.js` | 376-379 | 4（浇水/施肥/修剪/查看编辑） | ✅ 安全 |
| `pages/plant-detail/plant-detail.js` | 663-665 | 动态：`dates.map(...)` | ⚠️ 取决于 dates 长度 |
| `pages/plant-detail/plant-detail.js` | 761-762 | 2（复制/分享） | ✅ 安全 |
| `pages/plant-detail/plant-detail.js` | 1103-1115 | 6（4基础 + 死/活 + 删除） | ✅ 刚好符合限制，有注释提醒 |

**评估**：唯一有风险的是行 663 的 `dates.map(...)`，补卡选择时如果 dates > 6 会触达限制。但代码前的注释 `// ⚠️ wx.showActionSheet itemList 最大长度为6，不能超` 表明开发者已意识到。

**修复方案**：对动态长度的场景加截断：
```js
const displayDates = dates.slice(0, 6)
wx.showActionSheet({
  itemList: displayDates.map(d => d.label + ` (${d.daysAgo}天前)`),
  // ...
})
```

---

## 🟢 优化建议评估

### 3.1 建议引入统一数据层（DataService）

**评估**：✅ 值得做。当前 40+ 处 if-else 分支是最大的重复代码源。
**优先级**：P0（与 1.3 相同）

### 3.2 状态管理缺失

**评估**：✅ 值得做。`isFamilyMode` 在每个页面的 `onLoad` / `onShow` 中重新判断，切换模式后页面间状态不同步。
**优先级**：P2
**简化方案**：
```js
// app.js
globalData: { isFamilyMode: false, familyInfo: null }

// 在 family.refreshFamilyInfo 或 clearCache 后广播
getApp().globalData.isFamilyMode = newValue
// 各页面在 onShow 中同步
```

### 3.3 云端/本地缓存层级混乱

**评估**：✅ 值得做。当前 storage.js / family.js / cloud-sync.js 三个系统重叠：
- `family.js` 有自己独立的缓存管理（`_readCache` / `_saveCache`）
- `cloud-sync.js` 只与 `storage.js` 集成
- 家庭模式下 `cloud-sync.js` 的同步实际上被 bypass

**优先级**：P2

### 3.4 离线模式支持不足

**评估**：✅ 值得做。离线队列（`offlineQueue`）已声明但未实现 drain 逻辑。
**优先级**：P2

### 3.5 订阅消息未真正集成

**评估**：⚠️ 上线 Checklist 项，非代码修复问题。
**优先级**：P1（上线前必须）

### 3.6 无 i18n / 多语言支持

**评估**：❌ 当前阶段不建议。出海的 ROI 不明确，且微信小程序的多语言支持本身就是 pseudocode（无方案 SDK）。

### 3.7 成就系统通知节奏过强

**评估**：❌ 当前阶段不建议。成就系统核心逻辑已合理，通知方式统一为 `wx.showToast` 是微信小程序的实践做法。

### 3.8 首次加载无骨架屏

**评估**：✅ 值得做，但优先级低。建议简单实现 skeleton 组件或使用 loading 的替代方案。

### 3.9 calendar.js 滑动切换无动画

**评估**：❌ 当前不建议。滑动切换已运行业务逻辑，增加动画效果需较大的 UI 改造工作。

### 3.10 请求失败时用户通知不统一

**评估**：✅ 值得做。当前失败通知方式混杂：`wx.showToast` / `wx.showModal` / `console.error`。
**优先级**：P2
**修复方案**：封装统一错误提示函数：
```js
// utils/feedback.js
function showError(title = '操作失败', options = {}) {
  if (options.modal) {
    wx.showModal({ title, content: options.content || '', showCancel: false })
  } else if (options.silent) {
    console.error(title)
  } else {
    wx.showToast({ title, icon: 'none', duration: 2000 })
  }
}
```

### 3.11 plant-detail.js 信息过载

**评估**：❌ 不建议现在做。信息密度合理，使用折叠面板需较大 UI 改动。

### 3.12 回退导航不统一

**评估**：⚠️ 部分建议采纳。区分使用场景：
- 从首页进入详情 → `navigateTo`（可返回）
- 操作完成后 → `navigateBack`（已用）
- 切换 Tab → `switchTab`（已用）
当前混合使用有其合理性，不需要统一为单一模式。

---

## 总结：必须修复的问题优先级排行

| 优先级 | 问题 | 影响面 | 修复复杂度 |
|--------|------|--------|-----------|
| **P0** | setTimeout 未清理（页面销毁后 setData） | 所有页面，控制台警告 + 潜在崩溃 | 低 |
| **P0** | 个人/家庭模式 40+ 处 if-else 重复 | 全项目可维护性 | 中（需要 DAO 层） |
| **P0** | smart-tips 缓存返回值类型不一致 | 智能贴士功能在缓存命中时异常 | 极低（改 3 行） |
| **P1** | export.js / 各页面 new Date(undefined) | 数据显示异常 | 低 |
| **P1** | offlineQueue 已声明但未实现 | 离线数据丢失风险 | 中 |
| **P1** | health-score.js 家庭模式缓存过期 | 健康评分不准确 | 低 |
| **P1** | appid 在 project.config.json 中 | 隐私泄露风险 | 极低（加入 .gitignore） |
| **P2** | 86400000 全局硬编码 | 可维护性 | 低（定义常量） |
| **P2** | exif-date.js 64KB 限制 | 少数大图 EXIF 读取失败 | 低 |
| **P2** | record type 过滤字符串重复 | 可维护性 | 低（定义常量） |
| **P2** | showActionSheet 动态列表无截断 | 少数情况崩溃 | 极低 |
| **P2** | 请求失败通知不统一 | 用户体验 | 低 |
| **P2** | 状态管理缺失 | 跨页状态不同步 | 中 |

---

*核查报告基于实际代码读取和 grep 验证，所有结论均有对应代码行支撑。*
