# 关键注意事项 — 养花助手微信小程序

> 基于全项目代码审查提取的关键知识点，涵盖微信小程序平台限制、双模式架构、云开发、数据同步、资源管理等维度。
> 按重要性分级：🔴 P0（必须遵守）/ 🟡 P1（强烈建议）/ 🟢 P2（最佳实践）

---

## 目录

- [一、微信小程序平台限制](#一微信小程序平台限制)
- [二、双模式架构（个人模式 vs 家庭模式）](#二双模式架构个人模式-vs-家庭模式)
- [三、云开发特定问题](#三云开发特定问题)
- [四、数据同步策略](#四数据同步策略)
- [五、资源管理](#五资源管理)
- [六、UI/UX 限制](#六uiux-限制)
- [七、安全 / 隐私](#七安全--隐私)
- [八、性能优化](#八性能优化)

---

## 一、微信小程序平台限制

### 1.1 🔴 setTimeout 必须在页面销毁时清理

**问题描述：** 小程序页面 `onUnload` 后，`setTimeout` 回调仍然会执行。如果回调中调用了 `this.setData`，会报错（页面已销毁），导致内存泄漏和潜在崩溃。

**正确做法：** 每个使用定时器的页面，必须在 `data` 中维护 `_timers` 数组，在 `onUnload` 中统一清理。

**代码示例（本项目模式）：**

```js
// 定义辅助函数（每个页面文件头部都有）
function _timer(page, fn, delay) {
  const id = setTimeout(fn, delay)
  page.data._timers.push(id)
  return id
}

Page({
  data: {
    _timers: []
  },

  someMethod() {
    _timer(this, () => {
      this.setData({ showTip: false })
    }, 2000)
  },

  // ✅ 必须实现
  onUnload() {
    this.data._timers.forEach(id => clearTimeout(id))
    this.data._timers = []
  }
})
```

> 📌 **本项目所有页面**（index, plant-detail, add-plant, family, calendar）均遵循此模式。

---

### 1.2 🔴 tabBar 页面必须用 wx.switchTab 跳转

**问题描述：** `app.json` 中配置了 tabBar 的页面（如 `pages/index/index`、`pages/add-plant/add-plant`），不能用 `wx.navigateTo` 跳转，会直接报错。

**正确做法：**

```js
// ✅ tabBar 页面之间跳转
wx.switchTab({ url: '/pages/index/index' })

// ✅ 非 tabBar 页面跳转
wx.navigateTo({ url: '/pages/plant-detail/plant-detail?id=xxx' })
```

> 📌 本项目 tabBar 页面：`index`、`calendar`、`add-plant`、`profile`。注意 `add-plant` 既是 tabBar 页面又需要从识花结果跳回——用 `switchTab` + Storage 传递数据。

---

### 1.3 🔴 页面生命周期：onLoad 只执行一次，onShow 每次显示都执行

**问题描述：** tabBar 页面切换不会重新触发 `onLoad`，但会触发 `onShow`。如果数据加载只在 `onLoad` 中做，从其他页面返回时数据不会刷新。

**正确做法：**

```js
// add-plant.js 的处理方式：onShow 中检查识花结果
onShow() {
  const identified = wx.getStorageSync('identifiedPlant')
  if (identified) {
    wx.removeStorageSync('identifiedPlant')
    // 处理识花结果...
  }
}
```

```js
// index.js 的处理方式：onShow 中重新加载，但加节流
onShow() {
  const now = Date.now()
  if (now - this.data._lastLoadTime < 500) return  // 节流
  this.setData({ _lastLoadTime: now })
  this.initMode()
}
```

---

### 1.4 🟡 wx.showActionSheet itemList 最大长度为 6

**问题描述：** `wx.showActionSheet` 的 `itemList` 最多 6 项，超出会报错。

**本项目示例（plant-detail.js）：**

```js
showMoreActions() {
  // ⚠️ 不能超过6项
  const items = ['📝 添加备注', '📤 分享报告', '🩺 诊断病害', '🔖 补卡记录']
  if (this.data.userPlant.dead) {
    items.push('🌱 复活')
  } else {
    items.push('💀 标记嘎了')
  }
  items.push('🗑️ 删除植物')
  // 共6项，刚好不超限
}
```

---

### 1.5 🟡 wx.getStorageSync 是同步操作，大数据时阻塞 UI

**问题描述：** `wx.getStorageSync` 是同步阻塞的，如果存储的数据量很大（如 1000 条记录），频繁读取会卡顿。

**本项目策略：**

- 记录上限 1000 条（`storage.js` 中 `records.length > 1000` 时截断）
- 家庭模式使用缓存层（`family.js` 中 5 分钟 TTL），避免频繁读云函数
- 页面加载优先走缓存立即渲染，后台静默刷新

```js
// storage.js — 记录数量上限
addRecord(record) {
  const records = this.getRecordsRaw()
  records.unshift(record)
  if (records.length > 1000) records.splice(1000)  // 硬上限
  // ...
}
```

---

### 1.6 🟡 wx.chooseMedia 替代已废弃的 wx.chooseImage

**问题描述：** `wx.chooseImage` 在新版基础库中已标记为废弃，应使用 `wx.chooseMedia`。

**本项目大部分页面已迁移到 chooseMedia：**

```js
// ✅ 新API
wx.chooseMedia({
  count: 1,
  mediaType: ['image'],
  sourceType: ['album', 'camera'],
  sizeType: ['compressed'],
  success: (res) => {
    const tempPath = res.tempFiles[0].tempFilePath
  }
})
```

> ⚠️ `import-screenshot.js` 中仍在使用 `wx.chooseImage`，应迁移。

---

### 1.7 🟢 getCurrentPages() 获取页面栈

**本项目在多处使用：**

```js
// app.js — 错误上报时获取当前页面
const pages = getCurrentPages()
const currentPage = pages.length > 0 ? pages[pages.length - 1].route : 'unknown'

// plant-detail.js — 删除后通知上一页刷新
const pages = getCurrentPages()
const prevPage = pages.length >= 2 ? pages[pages.length - 2] : null
if (prevPage && prevPage.onShow) prevPage.onShow()
```

> ⚠️ 页面栈深度有限（最大10层），深层 `navigateTo` 会失败。

---

### 1.8 🟢 onShareAppMessage 和 onShareTimeline 的区别

**问题描述：** 两个分享接口用途不同，`onShareAppMessage` 是转发给好友，`onShareTimeline` 是分享到朋友圈。

```js
// 转发好友 — 可以带 path 参数
onShareAppMessage() {
  return {
    title: '我养了3棵植物，最长30天了！',
    path: '/pages/index/index'  // 好友点开后打开的页面
  }
}

// 分享朋友圈 — 不能带 path，只能带 query
onShareTimeline() {
  return { title: '...', query: '' }
}
```

> 📌 家庭邀请分享需要带 inviteCode 参数：`path: '/pages/family/family?inviteCode=xxx'`

---

## 二、双模式架构（个人模式 vs 家庭模式）

### 2.1 🔴 个人模式和家庭模式的数据层完全独立，每个页面必须分支处理

**问题描述：** 本项目同时支持：
- **个人模式**：数据存在 `wx.getStorageSync` 本地，ID 字段为 `id`
- **家庭模式**：数据通过云函数读写，ID 字段为 `_id`

每个涉及数据操作的页面和工具模块都需要判断模式并走不同分支。

**代码示例（plant-detail.js 中随处可见的分支）：**

```js
// 读取植物数据
if (isFamilyMode) {
  const userPlant = family.getPlantById(id)  // 返回 _id
  // ...
} else {
  const userPlant = storage.getPlantById(id)  // 返回 id
  // ...
}

// 完成任务
if (this.data.isFamilyMode) {
  await family.completeTask(taskId, note)
} else {
  storage.completeTask(taskId)
}
```

> ⚠️ **容易踩坑**：忘记某个分支导致个人模式下调用云函数报错，或家庭模式下只写本地不同步。

---

### 2.2 🔴 ID 字段不一致：个人模式 `id` vs 家庭模式 `_id`

**问题描述：** 这是全项目最频繁的坑。`storage.js` 生成的植物用 `id`，云数据库返回的用 `_id`。页面渲染时 `data-id` 需要统一。

**本项目的适配方式：**

```js
// index.js — 家庭模式下做 id 映射
const garden = plants.map(plant => {
  return {
    ...plant,
    id: plant._id,  // 统一映射为 id 供 WXML 使用
    // ...
  }
})

// 工具模块中的防御性代码
const plantId = userPlant._id || userPlant.id  // 兼容两种模式
const taskId = task.id || task._id
```

> 📌 在新增功能时，务必同时处理 `id` 和 `_id` 两种情况。

---

### 2.3 🟡 所有工具模块（health-score, achievement, export）都要同时支持两种模式

**问题描述：** 健康评分、成就系统、导出报告等模块都需要从两个数据源获取数据。

**代码示例（health-score.js）：**

```js
function calculateHealthScore(userPlant) {
  const isFamilyMode = family.isInFamily()
  let tasks, records

  if (isFamilyMode) {
    const plantId = userPlant._id || userPlant.id
    tasks = family.getCachedTasks(plantId)
    records = family.getCachedRecords(plantId)
  } else {
    tasks = storage.getTasksByPlant(userPlant.id)
    records = storage.getRecordsByPlant(userPlant.id)
  }
  // ... 计算逻辑
}
```

> 📌 每个新工具模块都需要考虑这个分支。

---

### 2.4 🟡 模式判断基于缓存 TTL，可能短暂误判

**问题描述：** `family.isInFamily()` 依赖本地缓存（5分钟 TTL）。如果用户在另一台设备退出了家庭，本地缓存可能还未过期，导致短暂误判。

```js
// family.js
function isInFamily() {
  const info = wx.getStorageSync(FAMILY_CACHE_KEY)
  if (!info || !info.inFamily) return false
  if (Date.now() - (info._cachedAt || 0) > CACHE_TTL) return false  // 5分钟
  return true
}
```

**建议：** 关键操作（如写数据）仍需 try-catch，服务端返回"未加入家庭"时静默降级。

---

### 2.5 🟢 模式切换时必须清理缓存

```js
// 退出家庭时
async leaveFamily() {
  const r = await family.manage('leave')
  if (r.success) {
    family.clearCache()  // ✅ 必须清理
    // clearCache 会删除 FAMILY_CACHE_KEY, FAMILY_PLANTS_KEY, FAMILY_TASKS_KEY, FAMILY_RECORDS_KEY
  }
}
```

---

## 三、云开发特定问题

### 3.1 🔴 wx.cloud.init 必须在使用云函数之前调用

**问题描述：** 云开发初始化只需一次（通常在 `app.js` 的 `onLaunch` 中），但如果初始化失败或未完成就调用云函数，会直接报错。

**本项目处理方式（app.js）：**

```js
onLaunch() {
  try {
    if (wx.cloud) {
      wx.cloud.init({ traceUser: true })
      this.cloudSync()  // 初始化后才能调用
    }
  } catch (e) {
    console.debug('[app] 云开发未启用，本地模式')
  }
}
```

> 📌 所有云函数调用都应该有降级逻辑（try-catch 或 .catch）。

---

### 3.2 🔴 云函数 callFunction 的 payload 有大小限制（约 5MB）

**问题描述：** `wx.cloud.callFunction` 的 `data` 参数传输有大小限制。如果直接传 base64 图片数据，超过 5MB 会失败。

**本项目处理（ai-identify.js）：**

```js
function readAndCheck(filePath, resolve) {
  wx.getFileSystemManager().readFile({
    filePath,
    encoding: 'base64',
    success: (r) => {
      const sizeKB = (r.data.length * 0.75) / 1024
      if (sizeKB > 4096) {
        // ✅ 超过4MB直接拒绝
        console.error('图片过大:', Math.round(sizeKB), 'KB')
        resolve(null)
        return
      }
      if (sizeKB > 800) {
        console.warn('图片较大:', Math.round(sizeKB), 'KB，云函数可能超时')
      }
      resolve(r.data)
    }
  })
}

// 压缩后再转 base64
function imageToBase64(path) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: path,
      quality: 40,  // 压缩到40%
      success: (res) => readAndCheck(res.tempFilePath, resolve),
      fail: () => readAndCheck(path, resolve)
    })
  })
}
```

---

### 3.3 🔴 cloud:// 协议的图片需要先转换才能使用

**问题描述：** 上传到云存储后的文件返回 `fileID`（格式 `cloud://xxx`），不能直接作为普通 URL 使用（如 `wx.downloadFile`）。需要先调用 `wx.cloud.getTempFileURL` 获取临时链接。

```js
// ai-identify.js — 处理 cloud:// 图片
async function identifyFromUrl(imageUrl) {
  if (url && url.startsWith('cloud://')) {
    const tmpRes = await new Promise((resolve) => {
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: resolve,
        fail: () => resolve(null)
      })
    })
    if (tmpRes && tmpRes.fileList[0] && tmpRes.fileList[0].tempFileURL) {
      url = tmpRes.fileList[0].tempFileURL
    } else {
      return { error: '无法获取图片临时链接' }
    }
  }
  // ...
}
```

> 📌 但在 WXML 中，`<image src="{{fileID}}">` 可以直接渲染 cloud:// 链接。

---

### 3.4 🟡 云函数调用必须有降级/错误处理

**问题描述：** 云函数可能因网络问题、超时、未部署等原因失败，前端必须有兜底逻辑。

**本项目模式（family.js — callCloud 包装函数）：**

```js
function callCloud(name, action, data) {
  return wx.cloud.callFunction({ name, data: { action, data } })
    .then(res => res.result)
    .catch(err => {
      console.error(`云函数 ${name}.${action} 失败:`, err)
      // ✅ 统一返回 { success: false, error } 而非 throw
      return { success: false, error: err.errMsg || err.message || '网络错误' }
    })
}
```

> 📌 所有调用方都不需要再 try-catch，统一检查 `result.success`。

---

### 3.5 🟡 云存储上传路径必须唯一

```js
// image.js — 使用时间戳 + 随机字符串
const cloudPath = 'plant-photos/' + Date.now() + '_' + 
  Math.random().toString(36).substr(2, 8) + '.jpg'
```

> ⚠️ 云存储同路径会覆盖，不唯一会导致图片丢失。

---

### 3.6 🟢 云存储临时文件应清理

```js
// import-screenshot.js — 解析完成后删除临时上传的文件
for (const fileID of fileIDs) {
  wx.cloud.deleteFile({ fileID }).catch(() => {})
}
```

---

## 四、数据同步策略

### 4.1 🔴 乐观写策略：先写本地缓存，后台推送云端

**问题描述：** 家庭模式下，如果等云端返回再更新 UI，用户会感觉卡顿。本项目采用"乐观写"（Optimistic UI）策略。

**family.js 的乐观写模式：**

```js
function addPlant(plantData) {
  const tempId = '_opt_' + Date.now() + '_' + (++_tempIdCounter)
  
  // 1️⃣ 立即写入本地缓存（乐观）
  cache.plants.unshift({ _id: tempId, ...plantData })
  _saveCache(FAMILY_PLANTS_KEY, cache)

  // 2️⃣ 后台推云端
  enqueueWrite(async () => {
    const result = await fdata('addPlant', { plant: plantData })
    if (result.success) {
      // 3️⃣ 用真实 ID 替换临时 ID
      const idx = c.plants.findIndex(p => p._id === tempId)
      if (idx >= 0) { c.plants[idx]._id = result.plantId }
    } else {
      // 4️⃣ 失败：移除乐观写入的数据（回滚）
      c.plants = c.plants.filter(p => p._id !== tempId)
    }
  })

  return Promise.resolve({ success: true, plantId: tempId, _optimistic: true })
}
```

**关键点：**
- 乐观写使用临时 ID（`_opt_` 前缀）
- 失败时必须回滚
- 成功后用真实 ID 替换临时 ID
- 前端乐观返回 `{ success: true, _optimistic: true }` 标记

---

### 4.2 🔴 写队列串行执行，避免并发冲突

**问题描述：** 多个写操作同时发往云端，可能导致顺序错乱或数据覆盖。本项目使用写队列确保串行执行。

```js
// family.js — 串行写队列
const _writeQueue = []
let _writing = false

function enqueueWrite(fn) {
  return new Promise((resolve) => {
    _writeQueue.push({ fn, resolve })
    _drainQueue()
  })
}

async function _drainQueue() {
  if (_writing) return
  _writing = true
  while (_writeQueue.length > 0) {
    const { fn, resolve } = _writeQueue.shift()
    try {
      const result = await fn()
      resolve(result)
    } catch (e) {
      resolve({ success: false, error: e.message })
    }
  }
  _writing = false
}
```

---

### 4.3 🟡 缓存优先策略：先渲染缓存，后台静默刷新

**问题描述：** 每次都等云函数返回再渲染会慢。本项目的标准模式：先用缓存数据立即渲染 UI，然后在后台静默拉取最新数据。

```js
// plant-detail.js — 记录加载的标准模式
async loadFamilyRecords(noWait) {
  if (noWait) {
    // 1️⃣ 先走缓存立即渲染
    const cachedRecords = family.getCachedRecords(plantId)
    if (cachedRecords.length > 0) {
      this.setData({ records: processed })
    }
    // 2️⃣ 后台静默刷新
    family.getRecords(plantId, 500, true).then(freshRecords => {
      this.setData({ records: fresh })
    })
    return
  }
  // 操作后刷新：等云端最新数据
  const records = await family.getRecords(plantId, 500, true)
  this.setData({ records })
}
```

---

### 4.4 🟡 增量合并同步：基于时间戳的冲突解决

**问题描述：** 本地数据和云端数据可能同时被修改，需要合并策略。

**cloud-sync.js 的合并策略：**

```js
function mergeArrays(localArr, cloudArr) {
  const map = new Map()
  
  // 先放云端数据
  cloudArr.forEach(item => { if (item.id) map.set(item.id, item) })
  
  // 再用本地数据覆盖（按时间戳判断）
  localArr.forEach(item => {
    const cloud = map.get(item.id)
    if (!cloud) {
      map.set(item.id, item)           // 本地新增
    } else {
      const localTime = item.updatedAt || item.addedAt || 0
      const cloudTime = cloud.updatedAt || cloud.addedAt || 0
      if (localTime >= cloudTime) {
        // 本地更新 → 以本地为准
        const merged = { ...cloud }
        Object.keys(item).forEach(key => {
          if (val === undefined || val === null) {
            delete merged[key]  // 显式删除 null/undefined 字段
          } else {
            merged[key] = val
          }
        })
        map.set(item.id, merged)
      }
    }
  })
  
  return Array.from(map.values()).filter(item => !item._deleted)
}
```

> ⚠️ **前提**：所有数据对象都必须有 `id`、`updatedAt`（或 `addedAt`）字段，否则合并不生效。

---

### 4.5 🟡 Debounce 同步：短时间多次写入合并为一次

```js
// cloud-sync.js — 3秒内合并多次写入
const pendingSyncs = {}
const SYNC_DELAY = 3000

function debouncedSync(key, collectionName, getData) {
  if (pendingSyncs[key]) {
    clearTimeout(pendingSyncs[key])  // 取消前一个
  }
  pendingSyncs[key] = setTimeout(async () => {
    delete pendingSyncs[key]
    const data = getData()
    if (data) await incrementalSync(collectionName, data)
  }, SYNC_DELAY)
}
```

> 📌 个人模式下，`storage.js` 每次 `saveGarden/saveTasks` 都会触发 `cloudSync.syncItem`，debounce 确保不会频繁调用云函数。

---

### 4.6 🟢 家庭模式缓存 TTL 5 分钟

```js
const CACHE_TTL = 5 * 60 * 1000  // 5分钟

// 缓存过期后强制重新拉取
if (Date.now() - (cached._cachedAt || 0) > CACHE_TTL) {
  // 重新请求云端
}
```

> 📌 首页额外加了 30 秒节流（`_lastCloudRefresh`），避免频繁 `onShow` 触发刷新。

---

## 五、资源管理

### 5.1 🔴 临时文件路径会过期，需及时上传

**问题描述：** `wx.chooseMedia` 返回的 `tempFilePath` 是临时路径，在小程序当前生命周期内有效，退出后失效。必须及时上传到云存储获取永久 `fileID`。

```js
// ai-identify.js / image.js — 选择图片后立即上传
// takePhoto 中：先上传头像再做识别
async doIdentify(imagePath) {
  // 立即上传图片作为头像（避免临时文件过期）
  this._identifyAvatarUrl = await imageUtil.uploadSquareAvatar(imagePath)
  // 然后再做识别...
}
```

---

### 5.2 🔴 图片必须压缩后再上传

**问题描述：** 原图可能几 MB 甚至十几 MB，直接上传消耗带宽和云存储空间，也会导致云函数处理超时。

```js
// image.js — 压缩后上传
function uploadImage(tempFilePath) {
  return new Promise(async (resolve) => {
    const compressed = await compressImage(tempFilePath, 80)  // 80%质量
    wx.cloud.uploadFile({
      cloudPath,
      filePath: compressed,
      success: (res) => resolve(res.fileID),
      fail: () => resolve(compressed)  // 失败降级用本地路径
    })
  })
}
```

---

### 5.3 🟡 EXIF 解析只读取文件头部，避免内存爆炸

**问题描述：** EXIF 元数据位于 JPEG 文件头部，不需要读取整个文件。

```js
// exif-date.js — 只读前 64KB
wx.getFileSystemManager().readFile({
  filePath,
  length: 65536,  // 只读 64KB
  success: (res) => {
    const dateStr = parseExifDate(res.data)
  }
})
```

> 📌 这是个轻量级的纯 JS EXIF 解析器，不依赖第三方库，非常适合小程序环境。

---

### 5.4 🟡 Canvas 离屏渲染需降级处理

**问题描述：** `wx.createOffscreenCanvas` 在低版本基础库不支持，需要 try-catch 降级。

```js
// image.js — 头像裁切
function resizeToSquare(tempFilePath, maxSize) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: tempFilePath,
      success: (info) => {
        try {
          const canvas = wx.createOffscreenCanvas({ type: '2d', width: maxSize, height: maxSize })
          // ... canvas 处理
        } catch (e) {
          // ✅ 降级到 compressImage
          wx.compressImage({ src: tempFilePath, quality: 50, success: r => resolve(r.tempFilePath), fail: () => resolve(tempFilePath) })
        }
      },
      fail: () => resolve(tempFilePath)
    })
  })
}
```

---

## 六、UI/UX 限制

### 6.1 🔴 wx.showActionSheet 最多 6 项

（见 1.4）

### 6.2 🟡 tabBar 图标必须使用本地图片

**问题描述：** `app.json` 中 tabBar 的 `iconPath` / `selectedIconPath` 必须是本地图片路径（相对路径），不支持网络图片和 cloud://。

```json
{
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "花园",
        "iconPath": "images/tab-garden.png",
        "selectedIconPath": "images/tab-garden-active.png"
      }
    ]
  }
}
```

> ⚠️ 图标尺寸建议 81×81，大小不超过 40KB。

---

### 6.3 🟡 分享路径必须以 / 开头

```js
// ✅ 正确
onShareAppMessage() {
  return {
    title: '...',
    path: '/pages/plant-detail/plant-detail?id=xxx'  // 绝对路径
  }
}

// ❌ 错误
path: 'pages/index/index'  // 缺少前导 /
```

> 📌 分享到朋友圈 `onShareTimeline` 不支持 `path` 参数，只支持 `query`。

---

### 6.4 🟡 wx.showModal editable 模式返回的 content 可能为空

```js
wx.showModal({
  title: '📝 记录一下',
  editable: true,
  placeholderText: '今天植物状态怎么样？',
  success: async (res) => {
    // ✅ 必须检查 res.confirm AND res.content
    if (res.confirm && res.content) {
      // ...
    }
  }
})
```

---

### 6.5 🟢 wx.vibrateShort 提供触觉反馈

```js
// 完成任务时的触觉反馈
async completeTask(e) {
  wx.vibrateShort({ type: 'light' })
  // ...
}
```

---

### 6.6 🟢 下拉刷新需要在 app.json 或页面 json 中配置

```js
// 页面中触发下拉刷新
onPullDownRefresh() {
  this.loadFamilyData().then(() => wx.stopPullDownRefresh())
}
```

> 📌 必须在页面对应的 `.json` 中配置 `"enablePullDownRefresh": true`，否则不生效。

---

## 七、安全 / 隐私

### 7.1 🔴 API Key 绝不能暴露在前端代码中

**问题描述：** 天气 API、AI 识别 API 的密钥如果写在前端代码中，会被反编译获取。

**本项目处理方式：**

```js
// smart-tips.js — 天气 API 通过云函数代理调用
function fetchWeather(city) {
  if (wx.cloud) {
    wx.cloud.callFunction({
      name: 'getWeather',  // ✅ Key 在云函数环境变量中
      data: { city }
    })
  } else {
    // 云函数未部署时不暴露 Key
    fetchWeatherDirect(city).then(resolve)  // 返回 null
  }
}

function fetchWeatherDirect(city) {
  // ✅ 不暴露 API Key，返回空
  return Promise.resolve(null)
}
```

```js
// ai-identify.js — 百度 API 在云函数中调用
function callCloudIdentify(base64) {
  return wx.cloud.callFunction({
    name: 'identifyPlant',  // ✅ API Key 在云函数中
    data: { imageData: base64 }
  })
}
```

---

### 7.2 🟡 wx.getLocation 需要用户授权

**问题描述：** 获取位置信息需要用户授权，用户可能拒绝。

**app.json 中声明权限：**

```json
{
  "permission": {
    "scope.userLocation": {
      "desc": "用于获取当地天气信息，提醒你雨天不用浇水"
    }
  }
}
```

**代码中优雅降级：**

```js
// index.js
wx.getLocation({
  type: 'gcj02',
  success: (loc) => {
    city = `${loc.longitude},${loc.latitude}`
    this._fetchWeather(city)
  },
  fail: () => {
    // ✅ 用户拒绝授权，使用默认城市
    city = '310000'  // 上海
    this._fetchWeather(city)
  }
})
```

---

### 7.3 🟡 订阅消息需要用户每次授权

**问题描述：** 微信小程序的订阅消息是"一次性"的，每次发送前都需要用户重新授权（除非选择了"总是保持以上选择"）。

```js
// subscribe.js — 每日最多询问一次
async function checkAndNotify(force) {
  const subscribeState = wx.getStorageSync('subscribeState') || {}
  const today = util.formatDate(Date.now())

  // ✅ 模板 ID 未替换时跳过（避免开发环境报错）
  if (isTemplatePlaceholder(SUBSCRIBE_TEMPLATES.WATER_REMINDER)) {
    return
  }

  // ✅ 每日只问一次（force=true 时忽略）
  if (force || subscribeState.lastAskDate !== today) {
    const accepted = await requestSubscribe(SUBSCRIBE_TEMPLATES.WATER_REMINDER)
    wx.setStorageSync('subscribeState', { lastAskDate: today, accepted })
  }
}
```

> ⚠️ 占位符检测函数很重要：开发阶段模板 ID 未申请时跳过订阅请求。
> ```js
> function isTemplatePlaceholder(id) {
>   return !id || id.startsWith('YOUR_')
> }
> ```

---

### 7.4 🟡 错误日志不要记录敏感信息

```js
// app.js — 错误上报，截断长度
reportError(type, error) {
  const errors = wx.getStorageSync('errorLog') || []
  errors.unshift({
    type,
    error: String(error).substring(0, 500),  // ✅ 截断防止过大
    time: Date.now(),
    page: getCurrentPages().slice(-1)[0]?.route || 'unknown'
  })
  if (errors.length > 50) errors.length = 50  // ✅ 最多50条
  wx.setStorageSync('errorLog', errors)
}
```

---

## 八、性能优化

### 8.1 🔴 setData 必须批量调用

**问题描述：** 每次 `setData` 都涉及 JS→原生通信，频繁调用会造成性能问题（尤其是数据量大时）。

**❌ 错误做法：**
```js
this.setData({ loading: true })
this.setData({ garden: plants })
this.setData({ stats: stats })
// 3次通信，性能差
```

**✅ 正确做法（本项目标准模式）：**
```js
// 一次性 setData 所有变更
this.setData({
  garden: sortedGarden,
  hasPlants: sortedGarden.length > 0,
  todayTasks,
  stats: { totalPlants, totalTasks, activeTasks, dueToday, totalRecords }
})
```

---

### 8.2 🔴 不要在 setData 中传递不需要渲染的数据

**问题描述：** `setData` 的数据会序列化传输到渲染层，传递大对象（如完整记录列表）只为了 WXML 不用的字段，浪费性能。

**本项目模式：** 使用 `_` 前缀的内部状态字段（不参与渲染）：
```js
data: {
  _timers: [],           // 不渲染
  _lastLoadTime: 0,      // 不渲染
  _lastCloudRefresh: 0,  // 不渲染
}
```

> ⚠️ 小程序中 `data` 中的所有字段都会被 `setData` 传输，但以 `_` 开头的字段在 WXML 中不使用，不会触发额外的 diff。

---

### 8.3 🟡 onShow 节流：避免频繁重新加载

```js
// index.js — 500ms 节流
onShow() {
  const now = Date.now()
  if (now - this.data._lastLoadTime < 500) return
  this.setData({ _lastLoadTime: now })
  this.initMode()
}

// initMode 中再加 30 秒节流控制云函数调用
async initMode() {
  const timeSinceRefresh = Date.now() - this.data._lastCloudRefresh
  if (timeSinceRefresh > 30000) {
    this.setData({ _lastCloudRefresh: Date.now() })
    this.loadFamilyData()
  } else {
    this.loadFamilyDataFromCache()  // 走缓存
  }
}
```

---

### 8.4 🟡 防并发请求：同一资源的并发请求复用

```js
// smart-tips.js — 天气请求防并发
const _weatherCachePending = {}

function fetchWeather(city) {
  const today = getDateStr()
  // 已有同天的并发请求，复用 Promise
  if (_weatherCachePending[today]) {
    return _weatherCachePending[today]
  }
  const p = new Promise(/* ... */)
  _weatherCachePending[today] = p
  p.then(w => {
    _weatherCache = { date: today, weather: w }
    delete _weatherCachePending[today]
  })
  return p
}
```

---

### 8.5 🟢 图片懒加载

**问题描述：** 植物列表中如果有大量图片，应该使用懒加载减少首屏加载时间。

```xml
<!-- WXML 中使用 lazy-load -->
<image src="{{plant.avatar}}" lazy-load mode="aspectFill" />
```

---

### 8.6 🟢 按日期缓存智能贴士

```js
// smart-tips.js — 每日只生成一次
const cacheKey = `smartTips_${plantId}_${dateStr}`
const cached = wx.getStorageSync(cacheKey)
if (cached && cached.length > 0) return cached
// 生成新的...
wx.setStorageSync(cacheKey, finalTips)

// 同时清理过期缓存
function cleanOldCache(todayStr) {
  const info = wx.getStorageInfoSync()
  info.keys.forEach(key => {
    if (key.startsWith('smartTips_') && !key.includes(todayStr)) {
      wx.removeStorageSync(key)
    }
  })
}
```

---

### 8.7 🟢 列表虚拟渲染（大量数据时）

**问题描述：** 花园列表通常不超过几十棵植物，但如果记录时间线很长，需要考虑虚拟列表。

> 📌 本项目记录列表做了截断（`records.slice(0, 200)`），实际未触发虚拟列表需求。

---

## 附：快速 Checklist

| 级别 | 检查项 | 文件 |
|------|--------|------|
| 🔴 | setTimeout 是否在 onUnload 中清理？ | 所有页面 |
| 🔴 | tabBar 页面跳转是否用 switchTab？ | 所有页面 |
| 🔴 | 云函数调用前是否已 wx.cloud.init？ | app.js |
| 🔴 | 云函数 data 是否 < 5MB？ | ai-identify.js |
| 🔴 | 个人/家庭模式分支是否全覆盖？ | 所有页面+工具模块 |
| 🔴 | ID 字段（id/_id）是否兼容处理？ | 所有涉及数据的代码 |
| 🔴 | setData 是否批量调用？ | 所有页面 |
| 🔴 | API Key 是否仅在云函数中？ | smart-tips, ai-identify |
| 🔴 | 临时文件是否已上传到云存储？ | image.js, takePhoto |
| 🔴 | 乐观写是否正确回滚？ | family.js |
| 🟡 | onShow 中是否有节流？ | index.js |
| 🟡 | showActionSheet 是否 ≤ 6 项？ | plant-detail.js |
| 🟡 | chooseImage 是否已迁移到 chooseMedia？ | import-screenshot.js ⚠️ |
| 🟡 | 缓存 TTL 是否合理？ | family.js (5min) |
| 🟡 | 订阅消息占位符检测是否到位？ | subscribe.js |
| 🟡 | getLocation 拒绝授权是否降级？ | index.js |
| 🟡 | 图片是否压缩后再上传？ | image.js |
| 🟢 | 智能贴士是否按日缓存？ | smart-tips.js |
| 🟢 | 错误日志是否截断+限量？ | app.js |
| 🟢 | 云存储临时文件是否清理？ | import-screenshot.js |

---

*最后更新：2026-06-14 · 基于全项目代码审查*
