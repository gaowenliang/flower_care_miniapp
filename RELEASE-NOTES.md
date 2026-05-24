# 🌱 养花助手 v1.1.0 Release Notes

**发布日期：** 2026-05-25

---

## 🏠 家庭花园

- **页面全面重构**：Tab 从 4 个扩展为 5 个 — 汇总、排行、报表、心愿、动态
- **邀请码隐私保护**：邀请码移入设置面板（头部 ⚙️ 图标），不再直接暴露
- **心愿单独立 Tab**：从"更多"里拆出来，独立一级入口，体验更好
- **设置面板**：右侧滑出，统一管理邀请码、昵称修改、成员管理、退出/解散
- **首页优先家庭**：打开 App 优先显示家庭花园，不再默认个人模式
- **家庭同步优化**：改头像/改名字后强制刷新缓存，其他成员能及时看到

## 🔍 AI 识花

- **云函数重写**：token 缓存 29 天、API Key 未配置友好提示、错误码中文翻译
- **科属信息提取**：从百度百科描述中自动解析「科」「属」，添加植物时不再写死"自定义"
- **结果页重做**：紧凑列表卡片（缩略图+名字+分数+科属标签），可上下滚动
- **稳定性提升**：去掉降级造假数据、图片压缩 quality 降到 40、base64 超 4MB 硬限制
- **未收录植物**：AI 识别但不在数据库的植物，自定义添加时自动带上科属信息

## 💰 花费体系

- **家庭报表**：修复 costStats 未传递的 bug，花费统计正常显示
- **首页统计条**：新增 💰 花费 chip

## 🪴 植物管理

- **头像自动裁切**：150×150 正方形 + quality 50%，每张约 3-5KB，省存储空间
- **头像同步**：家庭模式改头像后强制 getPlants(true)，其他人能看到

## 🐛 Bug 修复

- **health-score NaN**：addedAt 未定义时整个健康评分崩成 NaN
- **health-score 除零**：Math.ceil(7/Math.min(...)) 为 0 时 expectedRecords 除零
- **getCareStreak**：排除 cost/note 类型记录，花钱不算养护打卡
- **takePhoto 判空**：plant-detail 和 plant-journal 上传失败不存空记录
- **addPlant 防重复**：家庭模式同 plantId+nickname 不重复添加
- **表单残留**：6 个打开弹窗的地方都重置 price/purchaseDate/purchaseSource
- **名字输入框**：缺少 value="{{nickName}}" 绑定，输入文字不显示

## 🎨 UI 优化

- **TabBar 顺序**：花园 → 日历 → 添加 → 我的
- **输入框加宽加高**：padding 20→28rpx、line-height 1.4、modal-body 左右 padding 缩小
- **项目清理**：删除 15+ 预览文件、垃圾文件夹、package-lock.json

---

## ⚠️ 部署注意事项

1. **云函数必须重新部署**：`identifyPlant`（token 缓存 + 科属提取 + 错误处理）
2. **环境变量确认**：identifyPlant 的 `BAIDU_API_KEY` 和 `BAIDU_SECRET_KEY`
3. **云存储权限**：改成「所有用户可读，仅创建者可写」（否则别人看不到头像）
4. **其他云函数**：familyData、familyManage 等未改动，不需要重新部署
