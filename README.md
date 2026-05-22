# 🪴 养花助手 — 微信小程序

帮助用户管理植物花园、养护提醒、AI 识花、病害诊断，支持家庭共享。

## 项目信息

- **AppID:** `wx8ba3dab6769e7bb0`
- **框架:** 微信小程序原生 + 微信云开发
- **GitHub:** `git@github.com:gaowenliowenliang/flower_care_miniapp.git`

## 功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 我的花园 | ✅ | 植物列表、房间筛选、今日待办 |
| 添加植物 | ✅ | 搜索/分类浏览、拍照识花、自定义添加 |
| 养护提醒 | ✅ | 浇水/施肥/修剪/换盆/喷药，可调间隔 |
| 养护日历 | ✅ | 月视图，按日期查看养护计划 |
| 成长日记 | ✅ | 拍照记录、文字备注、成长对比 |
| AI 识花 | ✅ | 百度 AI 植物识别 |
| 病害诊断 | ✅ | 常见病害诊断和防治建议 |
| 成就系统 | ✅ | 养花成就、补卡机制 |
| 智能贴士 | ✅ | 根据天气和植物类型生成养护建议 |
| 健康评分 | ✅ | 植物健康度评估 |
| **家庭共享** | ✅ | 多人共享花园、邀请码加入 |
| **成员积分** | ✅ | 养护自动积分、排行榜 |
| **植物认养** | ✅ | 成员认养植物 |
| **打理报表** | ✅ | 成员贡献、养护类型统计 |

## 项目结构

```
flower-care-miniapp/
├── README.md              # 本文件
├── TEAM.md                # 团队分工
├── plan.md                # 开发计划（历史）
├── docs/
│   ├── design.md          # UI 设计规范
│   └── family-ui.png      # 家庭共享 UI 预览
├── miniprogram/
│   ├── pages/
│   │   ├── index/         # 首页：我的花园
│   │   ├── add-plant/     # 添加植物
│   │   ├── plant-detail/  # 植物详情（养护/记录/贴士）
│   │   ├── plant-journal/ # 成长日记
│   │   ├── calendar/      # 养护日历
│   │   ├── identify/      # AI 识花
│   │   ├── diagnose/      # 病害诊断
│   │   ├── profile/       # 个人中心
│   │   └── family/        # 家庭管理（共享/排行/报表）
│   ├── utils/
│   │   ├── storage.js     # 本地存储管理
│   │   ├── cloud-sync.js  # 云数据同步
│   │   ├── family.js      # 家庭模式工具
│   │   ├── achievement.js # 成就系统
│   │   ├── health-score.js# 健康评分
│   │   ├── smart-tips.js  # 智能贴士
│   │   ├── ai-identify.js # AI 识花
│   │   ├── image.js       # 图片上传
│   │   ├── disease.js     # 病害数据
│   │   ├── export.js      # 报告导出
│   │   ├── subscribe.js   # 订阅消息
│   │   ├── validator.js   # 输入校验
│   │   └── util.js        # 通用工具
│   ├── data/
│   │   └── plants.js      # 57 种植物数据库
│   ├── components/        # 自定义组件
│   ├── images/            # TabBar 图标
│   ├── app.js / app.json / app.wxss
│   └── sitemap.json
├── cloud/functions/
│   ├── initCollections/   # 初始化云数据库集合
│   ├── sendMessage/       # 发送订阅消息
│   ├── checkReminders/    # 定时检查养护提醒
│   ├── getWeather/        # 代理高德天气 API
│   ├── identifyPlant/     # AI 植物识别（百度）
│   ├── familyManage/      # 家庭管理（创建/加入/退出/认养/积分/报表）
│   └── familyData/        # 家庭数据（植物/任务/记录 CRUD）
├── server/                # 预留
└── tests/
    ├── unit/              # 单元测试
    ├── functional/        # 功能测试
    └── QA-REVIEW-R5.md    # 最新 QA 审查报告
```

## 家庭共享功能

### 工作流程
1. 「我的」→「家庭管理」→ 创建家庭 → 获得 6 位邀请码
2. 分享邀请码给家人 → 输入加入
3. 加入后所有页面自动切换到家庭模式（数据走云端）
4. 未加入家庭的用户不受影响，继续个人模式

### 权限
- **管理员**（创建者）：增删植物、踢人、解散家庭
- **成员**：记录养护、查看共享花园、认养植物
- 最多 10 人

### 积分规则
| 操作 | 积分 |
|------|------|
| 浇水 | +2 |
| 施肥 | +3 |
| 修剪 | +4 |
| 换盆 | +5 |
| 喷药 | +3 |
| 拍照 | +1 |
| 备注 | +1 |

### 数据库集合
| 集合 | 说明 |
|------|------|
| `families` | 家庭信息（名称、邀请码） |
| `family_members` | 成员关系（角色、积分、认养列表） |
| `family_plants` | 家庭植物（含认养者列表） |
| `family_records` | 养护记录（含操作者昵称） |
| `family_tasks` | 养护任务 |
| `user_plants` | 个人植物（非家庭模式） |
| `care_tasks` | 个人任务 |
| `care_records` | 个人记录 |
| `user_settings` | 用户设置 |
| `user_achievements` | 成就数据 |

## 部署步骤

1. 微信开发者工具打开项目
2. 上传所有云函数（`cloud/functions/` 下的 7 个）
3. 运行 `initCollections` 云函数创建集合
4. 集合权限设为「所有用户可读写」或按需配置

## 开发说明

- 小程序不支持 `div`，只能用 `view`
- 图片使用 `image` 组件
- 群内不使用翻白眼表情
