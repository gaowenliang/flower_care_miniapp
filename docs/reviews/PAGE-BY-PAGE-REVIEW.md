# 逐页审查报告 — 微信小程序优化点

> 审查日期: 2026-06-14  
> 项目路径: `miniprogram/`  
> 审查范围: 11 个页面 + 3 个 behavior

---

## 1. index（首页）

### 🔴 严重
- **无** — 该页面代码质量较高

### 🟡 建议
- **`cancelAddRoom()` 未清理 `newRoomName`**（`index.js:195`）：关闭添加房间弹窗时不清空输入框内容，虽然 `switchRoom('+ 添加')` 在打开前会重置，但如果将来有其他入口打开此弹窗，可能残留上次输入
- **`wx:for="{{todayTasks}}"` 无上限保护**（`index.wxml:72`）：今日待办在极端情况下（长时间未打开、大量逾期任务）可能列表较长，建议做"显示前N条+查看更多"

### 🟢 已OK
- 模态框 `catchtap="preventBubble"` 正确阻止冒泡 ✅
- `input` 有 `value="{{searchKeyword}}"` 绑定 ✅
- 弹窗仅 1 个 Boolean 字段 `showAddRoom` ✅
- 模态框使用 `wx:if`（条件渲染）✅
- `onUnload` 正确清理 `_timers` ✅

---

## 2. plant-detail（植物详情）

### 🔴 严重
- **无**

### 🟡 建议
- **弹窗 Boolean 字段过多**（`plant-detail.js:27-50`）：`showAddTask`, `showFertilizeModal`, `showRoomModal`, `showPriceModal`, `showRetroWater`, `showArrivalDateModal` 共 6 个弹窗开关（加上 behavior 里的 `showClassifyAction`, `showClassifySearch`, `showClassifyResult` 共 9 个）。建议合并为 `showModal: { type: 'price' | 'room' | ... }` 单一对象模式，减少 data 字段膨胀
- **`cancelPrice()` 未清理表单字段**（`plant-editor-behavior.js:85`）：关闭价格弹窗时不清空 `priceInput` / `sourceInput`，虽然下次打开 `editPrice()` 会重置，但 data 中残留旧值不够干净
- **`cancelArrivalDate()` 未清理表单字段**（`plant-editor-behavior.js:126`）：同理，`arrivalDateInput` 未重置
- **`hideAddTaskModal()` 未重置任务类型/间隔**（`task-manager-behavior.js:105`）：且 `showAddTaskModal()` 也未重置，若用户上次选了"换盆180天"后取消，下次再打开弹窗仍显示旧值
- **`plant-detail.wxml:143` 养护指南硬编码列表**：`wx:for="{{[{label:..., value:...}, ...]}}"` 7 个 item 的数组直接写在 WXML 中，可读性差，建议移到 JS data 或 computed
- **养护记录 `recordTimeline` 可能过长**：`loadFamilyRecords()` 最多拉取 500 条记录，时间线全部渲染可能导致性能问题，建议加入分页或"加载更多"

### 🟢 已OK
- 所有 9 个弹窗/菜单的 `modal-mask` 都有 `catchtap="preventBubble"` ✅
- 所有 `input` 都有 `value="{{xxx}}"` 绑定 ✅
- `cancelFertilize()` 正确清理 `fertilizeInput` + `pendingFertilizeTaskId` ✅
- `cancelRetroWater()` 正确清理 `retroWaterDate` + `retroWaterCustomDate` ✅
- 模态框统一使用 `wx:if` ✅

---

## 3. add-plant（添加植物）

### 🔴 严重
- **`_timer` 函数未定义**（`add-plant.js`）：`confirmAdd()` (L274)、`confirmCustomAdd()` (L248) 中调用了 `_timer(this, ...)`，但该文件顶部未定义 `_timer` 函数。同时 `onUnload()` 引用了 `this.data._timers`，但 data 中未声明 `_timers: []`。**这会导致运行时 ReferenceError，用户添加植物成功后页面切换延迟逻辑崩溃。**

### 🟡 建议
- **`closeModal()` 未清理表单字段**（`add-plant.js:279`）：`nickName`, `price`, `purchaseDate`, `purchaseSource`, `waterDays` 等字段在关闭弹窗时不重置，虽然 `selectPlant()` 会重新设置，但习惯上关闭时应清理
- **`closeCustomModal()` 同样未清理**（`add-plant.js:248`）：`customName`, `customPrice` 等字段残留
- **`filteredPlants` 全量渲染**（`add-plant.wxml:36`）：植物数据库可能包含 100+ 条目，在全部分类下会一次渲染所有植物卡片。建议加 scroll-view 或虚拟列表

### 🟢 已OK
- 3 个弹窗（识别结果、数据库添加、自定义添加）的 `modal-mask` 都有 `catchtap="preventBubble"` ✅
- 所有 input 都有 `value="{{xxx}}"` 绑定 ✅
- 模态框使用 `wx:if` ✅

---

## 4. calendar（养护日历）

### 🔴 严重
- **无**

### 🟡 建议
- **`photoTimeline` 列表无上限**（`calendar.wxml:107`）：成长相册随时间累积可能达到数百张，全部一次性渲染会影响性能。建议加"加载更多"分页或限制初始显示数量
- **`hideImportModal()` 未清理导入临时数据**（`calendar.js:130`）：关闭导入弹窗时不清空 `importRecords`, `importChecked` 等字段
- **月份切换手势灵敏度**：`_touchStartX` 和滑动阈值 60px 为硬编码，在不同屏幕尺寸下体验可能不一致

### 🟢 已OK
- 导入弹窗 `modal-mask` 有 `catchtap="preventBubble"` ✅
- 日历 grid 每页最多 42 个 cell（6×7），数量合理 ✅
- 模态框使用 `wx:if` ✅
- `onUnload` 正确清理 `_timers` ✅

---

## 5. family（家庭管理）

### 🔴 严重
- **无**

### 🟡 建议
- **设置面板使用 CSS `hidden` 而非 `wx:if`**（`family.wxml:302`）：`class="settings-mask {{showSettings?'show':''}}"`，面板始终渲染在 DOM 中。虽然有滑入动画需求，但设置面板使用频率极低，用 `wx:if` 配合 `animation` 或 `wx.createAnimation` API 可以同时实现动画和条件渲染
- **`wx:for="{{activities}}"` 固定 30 条**（`family.js:108`）：`family.getActivities(30)` 已限制，但 wxml 中没有"加载更多"
- **统计 Tab 内排行榜和成员列表重复渲染**：`leaderboard` 在汇总 Tab 和统计 Tab 各渲染一次，可以复用组件

### 🟢 已OK
- 创建/加入/心愿 3 个弹窗都有 `catchtap="preventBubble"` ✅
- 设置面板有 `catchtap="preventBubble"` ✅
- 所有 input 都有 `value="{{xxx}}"` 绑定 ✅
- `showCreateModal()` / `showJoinModal()` / `showAddWishModal()` 在打开前正确重置字段 ✅
- 弹窗 Boolean 仅 4 个，数量合理 ✅
- `onUnload` 正确清理 `_timers` ✅

---

## 6. profile（个人/家庭统计）

### 🔴 严重
- **无**

### 🟡 建议
- **`wx.showModal` 用于金额输入**（`profile.js:298,313`）：`addEquipmentCost()` 和 `addMaterialCost()` 使用 `wx.showModal` 的 `editable` 模式输入金额。系统弹窗的 editable 输入框在某些 Android 机型上有兼容问题（键盘遮挡、无法输入小数点）。建议改为自定义弹窗
- **`showAbout()` 用 `wx.showModal` 显示纯文本**（`profile.js:277`）：多行文本在系统弹窗中排版不受控，建议用自定义弹窗或单独页面
- **统计加载逻辑较重**：`onShow()` 每次都执行 `loadStats()` + `loadAchievements()` + `loadMonthlyStats()` + `loadCostStats()`，建议加入防抖或缓存，减少不必要的重复计算

### 🟢 已OK
- 无自定义弹窗，无需检查冒泡
- 无 input 元素，无需检查 value 绑定
- 使用 `wx:if` 控制成就展开/收起
- 花费用 `recentCosts` 限制为 10 条 ✅
- 植物按科列表通过 `toggleFamily` 折叠，避免一次展开过多 ✅

---

## 7. plant-journal（成长日记）

### 🔴 严重
- **无**

### 🟡 建议
- **`journal` 时间线无限增长**（`plant-journal.wxml:39`）：日记条目随时间累积无上限，多年的植物可能产生数百条日记组。虽然按日期分组减少了条目数，但建议加入年份筛选或分页加载
- **图片预览遮罩点图片也会关闭**（`plant-journal.wxml:63`）：`preview-mask` 上 `bindtap="closePreview"`，内部的 `image` 没有 `catchtap`。不过对于图片预览来说，点击图片关闭是常见 UX，这可能是设计意图。如果不是故意的，建议给 preview-img 加 `catchtap`
- **`toggleJournalMenu` 中的 `showMenu` 状态管理**（`plant-journal.js:147`）：通过遍历所有 journal 组来切换 `showMenu`，在条目多时 O(n) 遍历可能稍慢，建议只记录当前展开的 id

### 🟢 已OK
- `catchtap` 用于阻止照片/备注的菜单冒泡 ✅
- 无 input 元素，无需 value 绑定检查
- 弹窗仅 `showPreview` 一个，且用 `wx:if` ✅
- `onUnload` 正确清理 `_timers` ✅

---

## 8. identify（AI 识花）

### 🔴 严重
- **无**

### 🟡 建议
- **无显著问题** — 该页面代码简洁，结构清晰

### 🟢 已OK
- 无自定义弹窗（结果直接列表展示 + `bindtap` 跳转）✅
- 无 input 元素 ✅
- 识别结果列表通常 <10 条 ✅

---

## 9. diagnose（病害诊断）

### 🔴 严重
- **无**

### 🟡 建议
- **文字诊断结果和 AI 结果共享同一个 `results` 数组**（`diagnose.js:28`）：`useAIResult()` 把 AI 结果写入 `results`，如果用户先做 AI 识别再看文字诊断，前者会被覆盖。建议分离 `aiResults` 和 `textResults` 两个数组，或在 wxml 中区分显示
- **`_imageToBase64` 使用同步 `readFile`**（`diagnose.js:68`）：`wx.getFileSystemManager().readFile` 虽然是异步调用，但 `compressImage` + `readFile` 对大图片可能较慢

### 🟢 已OK
- `textarea` 有 `value="{{symptomText}}"` 绑定 ✅
- 无自定义弹窗 ✅
- 列表（快速症状标签 8 个、诊断结果 <5 个、AI 结果 <5 个）数量合理 ✅

---

## 10. import-screenshot（截图导入）

### 🔴 严重
- **`_timer` 函数未定义**（`import-screenshot.js:190`）：`confirmImport()` 中调用 `_timer(this, () => wx.navigateBack(), 1500)`，但文件顶部未定义 `_timer` 函数。**导入成功后页面自动返回逻辑会崩溃，抛出 ReferenceError。**
- **缺少 `onUnload` 清理**：如果 `_timer` 功能需要（虽然当前未定义），也缺少对应的 `_timers` 清理

### 🟡 建议
- **`wx:for="{{plants}}"` 植物选择器可能过长**（`import-screenshot.wxml:89`）：如果花园有 50+ 棵植物，picker 列表会很长。建议加搜索过滤
- **`parseImages()` 中调试弹窗应移除**（`import-screenshot.js:130-140`）：生产环境中弹出 `wx.showModal` 显示 OCR 原始文本和版本号，应仅保留在开发环境或完全移除

### 🟢 已OK
- 植物选择弹窗 `modal-mask` 有 `catchtap="preventBubble"` ✅
- 模态框使用 `wx:if` ✅

---

## 11. room-manage（房间管理）

### 🔴 严重
- **无**

### 🟡 建议
- **`hideAdd()` 未清理 `newRoomName`**（`room-manage.js:70`）：`showAdd()` 在打开时重置，但习惯上关闭时也应清理
- **`hideRename()` 未清理 `renameInput` / `renameOldName`**（`room-manage.js:74`）：同上
- **环境参数弹窗可滚动但未设 `scroll-view` 高度限制**（`room-manage.wxml:64`）：`env-scroll` 使用了 `<scroll-view scroll-y="true">` 但需依赖 CSS 限制高度，在小屏幕上 4 行选项可能导致内容溢出

### 🟢 已OK
- 重命名/添加/环境 3 个弹窗都有 `catchtap="preventBubble"` ✅
- 两个 input 都有 `value="{{xxx}}"` 绑定 ✅
- 弹窗使用 `wx:if` ✅
- 房间列表通常 <15 条 ✅

---

## 📊 汇总统计

| 检查项 | 通过 | 问题 |
|--------|------|------|
| 模态框事件冒泡 | 全部 ✅ | 0 |
| input/textarea value 绑定 | 全部 ✅ | 0 |
| data 弹窗 Boolean 过多 | 大部分 ✅ | 1 (plant-detail 有 9 个) |
| wx:if vs hidden | 大部分 ✅ | 1 (family 设置面板) |
| 弹窗状态清理 | 大部分 ✅ | 6 处不完整清理 |
| 长列表优化 | 大部分 ✅ | 4 处潜在性能问题 |
| **`_timer` 未定义（运行时错误）** | — | **2 处 🔴** |

### 🔴 必须修复
1. **`add-plant.js`**: `_timer` 未定义，`confirmAdd()` / `confirmCustomAdd()` / `onUnload()` 会崩溃
2. **`import-screenshot.js`**: `_timer` 未定义，`confirmImport()` 成功后自动返回逻辑崩溃

### 🟡 优先改进
1. `plant-detail`: 弹窗 Boolean 合并为 `showModal: { type }` 模式
2. `plant-detail`: `hideAddTaskModal()` 重置任务表单
3. `plant-detail` / `calendar` / `plant-journal`: 养护记录/相册列表加分页
4. `import-screenshot.js`: 移除生产环境调试弹窗
