# 养花助手微信小程序

## 项目目标
做一个帮助用户养花的微信小程序，核心功能：植物识别、养护提醒、养护知识库。

## 技术选型
- 前端：微信小程序原生框架（WXML + WXSS + JS）或 uni-app
- 后端：微信云开发（CloudBase）或独立后端（Node.js / Python）
- 数据库：云开发自带数据库 或 MySQL/MongoDB
- 图片识别：微信自带植物识别API 或 第三方AI（百度/阿里云）
- 消息推送：微信订阅消息

## 项目结构
```
flower-care-miniapp/
├── README.md          # 本文件
├── plan.md            # 详细开发计划
├── docs/              # 设计文档
│   ├── prd.md         # 产品需求文档
│   ├── design.md      # UI设计规范
│   └── api.md         # API接口文档
├── miniprogram/       # 小程序前端代码
│   ├── pages/         # 页面
│   ├── components/    # 组件
│   ├── utils/         # 工具函数
│   ├── images/        # 静态资源
│   ├── app.js
│   ├── app.json
│   └── app.wxss
├── cloud/             # 云函数（如用云开发）
└── server/            # 后端代码（如用独立后端）
```

## 开发阶段
详见 plan.md
