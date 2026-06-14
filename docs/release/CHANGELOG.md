# 📋 更新日志

## v1.4.0 — 代码质量大修（2026-06-14）

### 重构
- **plant-detail.js 拆分**：1170行→317行，提取 3 个 behavior（task-manager / plant-editor / record-manager）
- **WXSS 去重**：55 个重复样式块提取到 app.wxss，7 个页面瘦身
- **删除死代码**：theme.js、network.js、placement.js（零引用，-200行）

### 修复
- import-screenshot.js 废弃 API chooseImage → chooseMedia
- 6 处 Promise.then() 缺少 catch 补齐
- profile.js 竞态防护（_loadId 版本号机制）
- storage.js 新增数据迁移机制（v0→1→2）
- 天气缓存持久化到 Storage（冷启动秒显示）

### 优化
- 图片 lazy-load（identify/plant-journal/import-screenshot）
- console.log → console.debug
- 删除 app.js 旧接口残留

---

## v1.3.0 — 花费追踪 & UI 升级（2026-05-25）

### 新功能
- 💰 花费追踪体系（购入价格 + 维护花费 + 品类/月度统计）
- 🔬 AI 识花升级（科属提取 + base64 4MB 限制 + API Key 检查）
- 📑 家庭页面重构（5 Tab：汇总/排行/报表/心愿/动态）

### Bug 修复
- 首页家庭模式缓存为空时误进个人模式
- 植物头像上传后其他成员看不到
- 补卡日期写入错误
- plant-journal 上传失败写入空记录

---

## v1.1.0 — 家庭花园 & AI 识花重写（2026-05-25）

### 新功能
- 🏠 家庭页面全面重构（邀请码隐私保护、心愿单独立 Tab、设置面板）
- 🔍 AI 识花云函数重写（token 缓存 29 天、错误码中文翻译）
- 💰 花费统计（家庭报表 + 首页花费 chip）

### Bug 修复
- health-score NaN / 除零
- getCareStreak 排除 cost/note 类型记录
- 表单残留（6 处弹窗重置）
- 名字输入框缺少 value 绑定

---

## v1.0.0 — 初始版本

- 基础功能：花园管理、养护提醒、日历、成长日记
- AI 识花、病害诊断、成就系统、智能贴士、健康评分
- 家庭共享模式（乐观写架构）
