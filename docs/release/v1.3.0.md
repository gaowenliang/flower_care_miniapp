# 🌱 养花助手 v1.3.0 Release Note

**发布日期**：2026-05-25

---

## 🆕 新功能

### 花费追踪体系
- 💰 添加植物时可录入购入价格
- 🧾 完成养护任务时可记录维护花费
- 📊 「我的」页面新增花费统计（按品类、按月汇总）
- 👨‍👩‍👧‍👦 家庭报表新增花费维度

### AI 智能识花升级
- 🔬 识别结果自动提取植物科属信息（不再标记为"自定义"）
- 📏 识别图片 base64 限制 4MB，防止云函数溢出
- 🛡️ API Key 未配置时明确提示
- 🎯 识花结果弹窗改为居中卡片，支持滚动

### 家庭页面全面重构
- 📑 Tab 重排：汇总 → 排行 → 报表 → 心愿 → 动态
- 🔒 邀请码折叠隐藏，点击「邀请」按钮才展开（隐私保护）
- ⚙️ 退出/解散家庭移至设置入口
- 💝 心愿单独立 Tab

---

## 🐛 Bug 修复

### P0 关键修复
- 🔴 首页家庭模式缓存为空时优先云端确认，不再误进个人模式
- 🔴 添加植物名字输入框缺少 `value` 绑定，输入文字不显示
- 🔴 植物头像上传后其他家庭成员看不到（云存储权限修复）
- 🔴 补卡日期写入错误、补卡后刷新调错函数

### P1 重要修复
- 🟡 plant-journal takePhoto 上传失败时写入空记录 → 加判空跳过
- 🟡 getCareStreak 排除 cost/note 类型记录，花费不算养护天数
- 🟡 addPlant 家庭模式同植物防重复添加
- 🟡 云函数 updatePlant/updateTask 改为白名单（安全加固）
- 🟡 价格负数校验 Math.max(0, ...) 兜底

### P2 体验修复
- 🟢 achievement.js allDoneToday 条件修正
- 🟢 storage.js unshift 替代 push（新植物排前面）
- 🟢 division by zero 防护
- 🟢 console.log → console.debug（生产环境静默）

---

## 💅 UI 优化

- 所有输入框高度增加（padding 20rpx → 28rpx + min-height + line-height）
- 底部 TabBar 日历和添加按钮交换位置
- 植物头像自动裁切 150×150 正方形 + quality 0.5（预估 3-5KB/张）
- 识花结果弹窗居中卡片展示

---

## 📦 部署清单

### 云函数（必须重新部署）
| 云函数 | 改动 |
|--------|------|
| `identifyPlant` | 科属提取 + base64 限制 + API Key 检查 |
| `familyData` | 白名单 + 花费统计 |
| `familyManage` | 安全加固 + addRecord 校验 |
| `checkReminders` | 小修 |

### 环境配置
- ✅ 云函数 `identifyPlant` 环境变量：`BAIDU_API_KEY`、`BAIDU_SECRET_KEY`
- ✅ 云存储权限：所有用户可读，仅创建者可写

---

## ⚠️ 上线前检查

- [ ] 订阅消息模板 ID 替换（当前为占位符 `YOUR_WATER_TEMPLATE_ID`、`YOUR_CARE_TEMPLATE_ID`）
- [ ] 云存储权限确认
- [ ] 百度 API Key 有效性确认

---

**Commit 数**：27  
**改动文件**：前端 26 个 + 云函数 4 个  
**贡献者**：冬冬2（开发）、QA Agent（审查）
