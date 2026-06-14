# 代码审查报告 — 2026-06-14

> 全项目审查，基于 wechat-miniapp-notes skill 的 P0/P1/P2 清单

---

## 🔴 P0 — 必须修

### 1. `import-screenshot.js` 仍在用废弃的 `wx.chooseImage`

其他页面都已迁移到 `wx.chooseMedia`，唯独这个页面没跟上。新版本基础库可能不再支持。

```
miniprogram/pages/import-screenshot/import-screenshot.js:55: wx.chooseImage({
```

### 2. 云函数目录不存在

`app.js` 里 `wx.cloud.init` + `cloudSync()` 都在调，但项目里没有 `cloudfunctions/` 目录。意味着所有云函数（getWeather, identifyPlant, diagnosePlant, familyManage）都**还没部署**。目前靠降级逻辑兜着——天气返回 null、识花报错、家庭模式不可用。

**上线前必须创建并部署云函数。**

### 3. 订阅消息模板 ID 仍是占位符

```js
WATER_REMINDER: 'YOUR_WATER_TEMPLATE_ID',
CARE_REMINDER: 'YOUR_CARE_TEMPLATE_ID'
```

有 `isTemplatePlaceholder` 防护不会崩，但订阅推送功能完全不工作。

---

## 🟡 P1 — 强烈建议修

### 4. `plant-detail.js` 1170 行，61 次 setData — 上帝文件

这个文件承担了：详情展示、任务管理（完成/ postpone / 6种类型）、拍照记录、备注、补卡、改昵称/位置/价格/来源/入住日期、标记死亡、删除、头像、分享报告、健康评分、智能贴士、养花日志入口、诊断入口……

**建议拆分**：
- 任务管理 → `task-manager.js` (completeTask, postponeTask, completeAllTasks, addTask, toggleTask, changeInterval)
- 编辑操作 → `plant-editor.js` (editNickname, editLocation, editPrice, editArrivalDate, changeAvatar, markDead)
- 记录操作 → `record-manager.js` (takePhoto, addNote, retroCard, deleteRecord)

或者至少用 Behavior 提取（已有 `classify-behavior.js` 先例）。

### 5. WXSS 样式大量重复 — 5 个文件各自定义 `.modal-mask` / `.modal-content`

```
5 × .section-title
5 × .modal-mask
5 × .modal-content
3 × .modal-title
3 × .modal-btn.confirm / .cancel
3 × .loading-spinner
3 × .form-input
```

**建议**：提取公共样式到 `app.wxss` 或 `styles/common.wxss`，各页面 `@import`。

### 6. 三个未使用的工具模块

| 文件 | 行数 | 引用次数 |
|------|------|---------|
| `theme.js` | 60行 | **0 次** |
| `network.js` | 72行 | **0 次** |
| `placement.js` | 60行 | **0 次** |

- `theme.js`：定义了完整深色/浅色主题配色，但**没有任何页面 import 它**
- `network.js`：封装了 `checkNetwork` / `safeRequest`，但**没有任何页面使用**
- `placement.js`：植物摆放建议，**没有任何页面引用**

占 ~200 行死代码。要么接入使用，要么删掉。

### 7. `smart-tips.js` 引入了 `storage` 但从未使用

```js
const storage = require('./storage')  // ← 全文无调用
```

### 8. 多处 `.then()` 链没有 `.catch()`

```
index.js:66      family.refreshFamilyInfo().then(info => {
index.js:313     tryCloud().then(w => {
index.js:535     this.loadFamilyData().then(() => wx.stopPullDownRefresh())
plant-detail.js:344  family.updateTask(...).then(() => this.loadFamilyTasks())
plant-detail.js:360  family.toggleTask(...).then(() => this.loadFamilyTasks())
plant-journal.js:212 Promise.all(promises).then(() => {
```

虽然 `family.js` 内部的 `callCloud` 有 catch，但如果 `.then` 回调内部出错就没人接。建议加 `.catch(err => console.error(...))`。

### 9. `profile.js` 无 onUnload，但有 onShow 异步操作

`onShow` 里连续调 `loadStats` / `loadAchievements` / `loadMonthlyStats` / `loadCostStats`，快速切 tab 时可能产生竞态（旧请求后返回覆盖新请求）。建议加版本号或 AbortController 模式。

### 10. `storage.js` 无数据迁移机制

没有版本号、没有 migration 逻辑。如果后续改字段名或数据结构，老用户本地数据会静默失败。建议加：

```js
const DB_VERSION = 2
function migrate() {
  const v = wx.getStorageSync('_db_version') || 1
  if (v < 2) { /* 迁移逻辑 */ wx.setStorageSync('_db_version', 2) }
}
```

---

## 🟢 P2 — 最佳实践 / 可优化

### 11. 列表图片缺 lazy-load

```wxml
<!-- diagnose.wxml -->
<image class="photo-img" src="{{photoPath}}" mode="aspectFill" />
<!-- plant-journal.wxml -->
<image class="compare-img" src="{{item.photo}}" mode="aspectFill" />
```

列表场景应加 `lazy-load`。

### 12. console.log 残留 6 处

生产代码不应保留 `console.log`（`console.error` / `console.warn` / `console.debug` 可以留）。

### 13. `add-plant.js` 和 `family.js` setData 过于频繁

add-plant.js 有 40 次 setData、family.js 36 次。很多是输入框绑定（`onNickNameInput`、`onPriceInput`），这种应该用模型绑定（WXML `model:value`）减少 JS setData 开销。

### 14. 天气缓存可以持久化到 Storage

当前 `_weatherCache` 是模块级变量，冷启动丢失。如果存到 `wx.setStorageSync('_weather_cache', { date, weather })`，次日打开也能秒显示。

### 15. `app.js` 的 `getMyGarden` / `saveMyGarden` / `getCareTasks` / `saveCareTasks` 是旧接口残留

注释写了"保留旧接口兼容"，但全项目没有调用方。可以删。

---

## 📊 总结

| 级别 | 数量 | 状态 |
|------|------|------|
| 🔴 P0 | 3 | chooseImage 迁移、云函数部署、模板 ID |
| 🟡 P1 | 7 | 上帝文件拆分、样式去重、死代码清理、错误处理、竞态防护、数据迁移 |
| 🟢 P2 | 5 | lazy-load、日志清理、setData 优化、缓存持久化、旧接口删除 |

**优先级建议**：
1. 先修 P0（影响功能正常使用）
2. 再做样式去重 + 删死代码（改善可维护性，工作量小）
3. 最后拆 plant-detail.js（工作量大但值得做）
