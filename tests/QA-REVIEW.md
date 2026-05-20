# QA Review 报告 — 2026-05-20

## 审查范围
全量代码，共 1737 行 JS + 6 个页面 WXML/WXSS

## 发现问题 & 修复

| # | 严重度 | 文件 | 问题 | 状态 |
|---|--------|------|------|------|
| 1 | 🔴 严重 | plant-detail.js L195 | `changeAvatar()` 后缺少逗号，会导致整个 Page 注册失败 | ✅ 已修复 |
| 2 | 🟡 中等 | index.js | 引用 `app = getApp()` 但未使用，多余的依赖 | ✅ 已清理 |
| 3 | 🟡 中等 | plant-journal.js | 日记页只展示照片类型记录，备注(notes)被忽略 | ✅ 已修复 |
| 4 | 🟢 轻微 | plant-journal.wxml | 照片时间显示为日期组的 time（同天多个照片时间相同） | ✅ 改为每张独立时间 |
| 5 | 🟢 轻微 | plant-journal.wxml | 日记页 wxml 里有个 `</div>` 应为 `</view>` | ✅ 随 #3 一起修 |

## 代码质量评估

### ✅ 做得好的
- **StorageManager** 统一数据层设计合理，CRUD 完整，级联删除正确
- **工具函数** 纯函数设计，易于测试，60个单测覆盖
- **数据模型** 植物数据库字段完整，20种植物养护信息丰富
- **错误处理** 植物不存在时有 toast + 自动返回
- **云开发兼容** app.js 用 try-catch 包裹，非云环境不报错

### ⚠️ 后续需关注
1. **本地存储上限** — 微信小程序单key上限10MB，500条记录限制合理但图片路径如果包含 base64 会膨胀
2. **订阅消息模板** — 硬编码 YOUR_TEMPLATE_ID 需替换为实际申请的 ID
3. **图片持久化** — 当前用 tempFilePath，小程序重启后可能失效，需考虑云存储上传
4. **日历性能** — 植物数量多时 getDueDatesInMonth 的循环推算可能有性能问题，加个上限保护
5. **无障碍** — 图片缺少 aria-label，纯 emoji 作图标对屏幕阅读器不友好

## 测试结果

```
Unit Tests: 60/60 passed (0.13s)
├── util.test.js     — 30 cases ✅
└── storage.test.js  — 30 cases ✅ (含 deleteRecord 新增)

Functional Tests: 已编写，需微信开发者工具环境运行
```

## 建议 @质量QA 后续补充
1. 给 plant-journal 补充单元测试（分组逻辑、日期标签）
2. 给 storage.deleteRecord 补单测（已合入 storage.test.js 的 mock 环境）
3. 功能测试需在微信开发者工具真机环境跑
