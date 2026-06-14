# 🪴 养花助手 — 微信小程序

帮助用户管理植物花园、养护提醒、AI 识花、病害诊断，以**家庭共享**为核心。

## 项目信息

- **AppID:** `wx8ba3dab6769e7bb0`
- **框架:** 微信小程序原生 + 微信云开发
- **GitHub:** `git@github.com:gaowenliang/flower_care_miniapp.git`

## 设计理念

**以家庭为核心**：加入家庭后，所有数据（植物、任务、记录、统计、成就）自动切换到云端共享模式。未加入家庭则使用个人本地模式，体验完全一致。

**本地优先，后台同步**：家庭模式下采用乐观写架构 — 操作瞬间生效（本地缓存），后台串行推云端，失败自动回滚。

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
| 成就系统 | ✅ | 养花成就、补卡机制（个人模式） |
| 智能贴士 | ✅ | 根据天气和植物类型生成养护建议 |
| 健康评分 | ✅ | 植物健康度评估（个人/家庭均支持） |
| **家庭共享** | ✅ | 多人共享花园、邀请码加入 |
| **成员积分** | ✅ | 养护自动积分、排行榜 |
| **植物认养** | ✅ | 成员认养植物 |
| **打理报表** | ✅ | 成员贡献、养护类型统计 |
| **心愿单** | ✅ | 想养的植物心愿单 |
| **里程碑** | ✅ | 植物养护天数里程碑自动记录 |
| **周报/PK** | ✅ | 本周之星、周报总结 |

## 项目结构

```
flower-care-miniapp/
├── README.md              # 本文件
├── TEAM.md                # 团队分工
├── docs/
│   ├── design.md          # UI 设计规范
│   ├── KEY-NOTES.md       # 关键注意事项（35+ 条，按 P0/P1/P2 分级）
│   ├── reviews/           # 代码审查报告
│   ├── release/           # 版本发布记录 & CHANGELOG
│   └── *.html             # UI 预览
├── miniprogram/
│   ├── pages/
│   │   ├── index/         # 首页：花园（家庭/个人自适应）
│   │   ├── add-plant/     # 添加植物
│   │   ├── plant-detail/  # 植物详情（养护/记录/贴士/健康评分）
│   │   │   ├── plant-detail.js          # 主页面（数据加载/生命周期）
│   │   │   ├── classify-behavior.js     # 分类行为
│   │   │   ├── task-manager-behavior.js # 任务管理（完成/添加/调整）
│   │   │   ├── plant-editor-behavior.js # 编辑操作（昵称/价格/位置等）
│   │   │   └── record-manager-behavior.js # 记录管理（拍照/备注/补卡）
│   │   ├── plant-journal/ # 成长日记
│   │   ├── calendar/      # 养护日历
│   │   ├── identify/      # AI 识花
│   │   ├── diagnose/      # 病害诊断
│   │   ├── profile/       # 我的（统计/成就/设置）
│   │   ├── family/        # 家庭管理（动态/排行/报表/心愿单/里程碑）
│   │   ├── plant-journal/ # 成长日记
│   │   ├── identify/      # AI 识花
│   │   ├── diagnose/      # 病害诊断
│   │   ├── room-manage/   # 房间管理
│   │   └── import-screenshot/ # 导入截图
│   ├── utils/
│   │   ├── storage.js     # 本地存储管理（个人模式数据源）
│   │   ├── family.js      # 家庭模式工具 v3（乐观写 + 写队列）
│   │   ├── cloud-sync.js  # 云数据同步
│   │   ├── achievement.js # 成就系统（自适应家庭/个人）
│   │   ├── health-score.js# 健康评分（自适应家庭/个人）
│   │   ├── smart-tips.js  # 智能贴士
│   │   ├── ai-identify.js # AI 识花
│   │   ├── image.js       # 图片上传
│   │   ├── disease.js     # 病害数据
│   │   ├── export.js      # 报告导出（自适应家庭/个人）
│   │   ├── subscribe.js   # 订阅消息（自适应家庭/个人）
│   │   ├── validator.js   # 输入校验
│   │   ├── exif-date.js   # EXIF 日期解析
│   │   └── util.js        # 通用工具
│   ├── data/
│   │   └── plants.js      # 57 种植物数据库
│   ├── components/        # 自定义组件
│   ├── images/            # TabBar 图标
│   └── app.js / app.json / app.wxss
├── cloud/functions/
│   ├── initCollections/   # 初始化云数据库集合
│   ├── sendMessage/       # 发送订阅消息
│   ├── checkReminders/    # 定时检查养护提醒
│   ├── getWeather/        # 代理高德天气 API
│   ├── identifyPlant/     # AI 植物识别（百度）
│   ├── familyManage/      # 家庭管理（创建/加入/退出/认养/积分/报表）
│   └── familyData/        # 家庭数据 CRUD（植物/任务/记录）
└── tests/
    ├── unit/              # 单元测试
    └── functional/        # 功能测试
```

## 架构：家庭模式 v3

### 数据流

```
┌─────────────────────────────────────────────────────┐
│                      页面层                          │
│  index / plant-detail / profile / calendar / ...    │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
        family.isInFamily()?      │
               │                  │
      ┌────────▼────────┐  ┌─────▼──────┐
      │   family.js v3   │  │ storage.js │
      │  (乐观写+缓存)    │  │ (本地存储)  │
      └──┬─────┬────────┘  └────────────┘
   读缓存 │     │ 写队列
         │     │
    ┌────▼──┐  ▼
    │缓存TTL│ 串行推云端
    │5分钟  │ 失败回滚
    └───────┘
```

### 乐观写（Optimistic Write）

所有写操作（completeTask/addPlant/updatePlant/removePlant/toggleAdopt/updateTask/toggleTask/addRecord/deleteRecord）遵循：

1. **立即写本地缓存** → 返回 `{ success: true, _optimistic: true }`
2. **页面从缓存刷新 UI** → 用户感知零延迟
3. **写队列串行推云端** → 避免并发冲突
4. **云端成功** → 静默拉真数据覆盖缓存
5. **云端失败** → 回滚本地缓存到操作前状态

### 全模块家庭适配

以下工具模块在家庭模式下自动从云端缓存读取数据：

| 模块 | 适配内容 |
|------|----------|
| health-score.js | 从 family.getCachedTasks/Records 算健康评分 |
| achievement.js | 从云端数据算成就（连续天数、月度记录等） |
| export.js | 导出报告支持云端数据源 |
| subscribe.js | 养护提醒支持家庭模式 |
| smart-tips.js | 天气城市码可配置 |
| profile.js | 统计、月度图表从云端算，加载态防闪烁 |

## 家庭共享功能

### 工作流程
1. 「我的」→「家庭管理」→ 创建家庭 → 获得 6 位邀请码
2. 分享邀请码给家人 → 输入加入
3. 加入后**所有页面自动切换到家庭模式**
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
| `family_activities` | 动态流 |
| `family_milestones` | 里程碑 |
| `family_wishlists` | 心愿单 |

## 部署步骤

1. 微信开发者工具打开项目
2. 上传所有云函数（`cloud/functions/` 下的 7 个）
3. 运行 `initCollections` 云函数创建集合
4. 集合权限设为「所有用户可读写」或按需配置
5. 云函数 `identifyPlant` 环境变量配置：
   - `BAIDU_API_KEY` = 百度AI平台的API Key
   - `BAIDU_SECRET_KEY` = 百度AI平台的Secret Key
6. 云函数 `getWeather` 环境变量配置：
   - `AMAP_KEY` = 高德地图API Key

## 开发说明

- 详细开发注意事项见 [`docs/KEY-NOTES.md`](docs/KEY-NOTES.md)（35+ 条，按 P0/P1/P2 分级）
- 家庭模式下数据全在云端，通过 family.js 缓存层访问
- 个人模式下数据全在本地 storage
- 所有模块通过 `family.isInFamily()` 自动切换数据源
