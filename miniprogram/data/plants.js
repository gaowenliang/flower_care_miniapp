// 植物数据库 - 常见100种
module.exports = {
  plants: [
    {
      id: 'monstera',
      name: '龟背竹',
      latin: 'Monstera deliciosa',
      family: '天南星科',
      category: '绿植',
      emoji: '🪴',
      image: '/images/plants/monstera.png',
      care: {
        light: '明亮散射光',
        waterDays: 7,
        waterAmount: '浇透',
        temperature: '15-30°C',
        humidity: '60-80%',
        soil: '疏松透气的营养土',
        fertilizer: '春秋每月一次稀薄液肥',
        difficulty: '简单',
        toxicity: '对宠物有毒'
      },
      tips: [
        '叶片上的孔洞是正常特征',
        '可用湿布擦拭叶片保持光泽',
        '气生根可以引导插入土中'
      ]
    },
    {
      id: 'succulent',
      name: '多肉植物',
      latin: 'Succulents',
      family: '景天科',
      category: '多肉',
      emoji: '🌵',
      image: '/images/plants/succulent.png',
      care: {
        light: '充足直射光',
        waterDays: 14,
        waterAmount: '浇透等干',
        temperature: '10-35°C',
        humidity: '30-50%',
        soil: '颗粒土为主（7:3颗粒:泥炭）',
        fertilizer: '生长期每月一次多肉专用肥',
        difficulty: '简单',
        toxicity: '无毒'
      },
      tips: [
        '宁干勿湿是多肉的黄金法则',
        '夏季高温休眠期控水',
        '叶片发皱是缺水信号'
      ]
    },
    {
      id: 'pothos',
      name: '绿萝',
      latin: 'Epipremnum aureum',
      family: '天南星科',
      category: '绿植',
      emoji: '🌿',
      image: '/images/plants/pothos.png',
      care: {
        light: '耐阴，散射光即可',
        waterDays: 5,
        waterAmount: '浇透',
        temperature: '15-35°C',
        humidity: '50-70%',
        soil: '普通营养土即可',
        fertilizer: '春秋每月一次',
        difficulty: '超简单',
        toxicity: '汁液微毒'
      },
      tips: [
        '水培也可以，每周换水',
        '黄叶多为浇水过多',
        '可以悬挂让藤蔓垂下'
      ]
    },
    {
      id: 'rose',
      name: '月季',
      latin: 'Rosa chinensis',
      family: '蔷薇科',
      category: '花卉',
      emoji: '🌹',
      image: '/images/plants/rose.png',
      care: {
        light: '充足直射光（6h+/天）',
        waterDays: 3,
        waterAmount: '浇透',
        temperature: '15-28°C',
        humidity: '50-70%',
        soil: '疏松肥沃的微酸性土',
        fertilizer: '花期每周一次磷钾肥',
        difficulty: '中等',
        toxicity: '有刺，注意安全'
      },
      tips: [
        '花后及时修剪残花促复花',
        '注意防治红蜘蛛和白粉病',
        '冬季重剪利于来年开花'
      ]
    },
    {
      id: 'orchid',
      name: '蝴蝶兰',
      latin: 'Phalaenopsis',
      family: '兰科',
      category: '花卉',
      emoji: '🦋',
      image: '/images/plants/orchid.png',
      care: {
        light: '明亮散射光',
        waterDays: 10,
        waterAmount: '浸盆法10分钟',
        temperature: '18-28°C',
        humidity: '60-80%',
        soil: '水苔或树皮',
        fertilizer: '花期不施，生长期薄肥勤施',
        difficulty: '中等',
        toxicity: '无毒'
      },
      tips: [
        '花朵凋谢后花梗可保留可能复花',
        '根系发绿表示水分充足',
        '银白色根系表示需要浇水'
      ]
    },
    {
      id: 'mint',
      name: '薄荷',
      latin: 'Mentha',
      family: '唇形科',
      category: '香草',
      emoji: '🌱',
      image: '/images/plants/mint.png',
      care: {
        light: '充足光照',
        waterDays: 2,
        waterAmount: '保持湿润',
        temperature: '15-30°C',
        humidity: '50-70%',
        soil: '普通营养土',
        fertilizer: '每月一次通用肥',
        difficulty: '超简单',
        toxicity: '可食用'
      },
      tips: [
        '生长极快，定期修剪',
        '可以扦插繁殖',
        '泡水泡茶都很棒'
      ]
    },
    {
      id: 'snake-plant',
      name: '虎皮兰',
      latin: 'Sansevieria trifasciata',
      family: '天门冬科',
      category: '绿植',
      emoji: '🎍',
      image: '/images/plants/snake-plant.png',
      care: {
        light: '耐阴到明亮光',
        waterDays: 14,
        waterAmount: '浇透等干透',
        temperature: '10-35°C',
        humidity: '30-50%',
        soil: '疏松沙质土',
        fertilizer: '春夏每月一次',
        difficulty: '超简单',
        toxicity: '微毒'
      },
      tips: [
        '超级耐旱，宁干勿湿',
        '净化空气效果极佳',
        '叶尖发黄多为浇水过多'
      ]
    },
    {
      id: 'fiddle-leaf',
      name: '琴叶榕',
      latin: 'Ficus lyrata',
      family: '桑科',
      category: '绿植',
      emoji: '🌳',
      image: '/images/plants/fiddle-leaf.png',
      care: {
        light: '明亮散射光',
        waterDays: 7,
        waterAmount: '浇透等表层2cm干',
        temperature: '16-30°C',
        humidity: '50-70%',
        soil: '疏松透气营养土',
        fertilizer: '春夏每月一次',
        difficulty: '中等',
        toxicity: '汁液微毒'
      },
      tips: [
        '不喜欢频繁移动位置',
        '叶片大需定期擦拭',
        '冬季注意保温防冻'
      ]
    },
    {
      id: 'cactus',
      name: '仙人掌/仙人球',
      latin: 'Cactaceae',
      family: '仙人掌科',
      category: '多肉',
      emoji: '🌵',
      image: '/images/plants/cactus.png',
      care: {
        light: '充足直射光',
        waterDays: 21,
        waterAmount: '浇透等完全干透',
        temperature: '5-40°C',
        humidity: '20-40%',
        soil: '砂质土+颗粒',
        fertilizer: '生长期每月一次稀薄肥',
        difficulty: '超简单',
        toxicity: '无毒（有刺）'
      },
      tips: [
        '一个月浇一次水都行',
        '冬季休眠几乎不用浇水',
        '开花需要充足光照和温差'
      ]
    },
    {
      id: 'lavender',
      name: '薰衣草',
      latin: 'Lavandula',
      family: '唇形科',
      category: '香草',
      emoji: '💜',
      image: '/images/plants/lavender.png',
      care: {
        light: '充足直射光（6h+）',
        waterDays: 5,
        waterAmount: '浇透等干',
        temperature: '10-30°C',
        humidity: '30-50%',
        soil: '碱性疏松土',
        fertilizer: '少量即可，忌氮肥过多',
        difficulty: '中等',
        toxicity: '无毒，可做香料'
      },
      tips: [
        '通风非常重要，闷热易枯',
        '花后修剪促进分枝',
        '可以干燥做香囊'
      ]
    },
    {
      id: 'tomato',
      name: '小番茄',
      latin: 'Solanum lycopersicum',
      family: '茄科',
      category: '蔬果',
      emoji: '🍅',
      image: '/images/plants/tomato.png',
      care: {
        light: '充足直射光（8h+）',
        waterDays: 2,
        waterAmount: '保持均匀湿润',
        temperature: '20-30°C',
        humidity: '50-70%',
        soil: '肥沃疏松营养土',
        fertilizer: '花期磷钾肥，果期钙肥',
        difficulty: '中等',
        toxicity: '叶茎有毒，果实可食'
      },
      tips: [
        '阳台种植选矮生品种',
        '需要搭架子支撑',
        '人工授粉可提高坐果率'
      ]
    },
    {
      id: 'peperomia',
      name: '豆瓣绿',
      latin: 'Peperomia obtusifolia',
      family: '胡椒科',
      category: '绿植',
      emoji: '🍃',
      image: '/images/plants/peperomia.png',
      care: {
        light: '散射光到明亮光',
        waterDays: 7,
        waterAmount: '浇透等干',
        temperature: '18-28°C',
        humidity: '40-60%',
        soil: '疏松透气营养土',
        fertilizer: '春夏每月一次',
        difficulty: '简单',
        toxicity: '无毒'
      },
      tips: [
        '叶片肥厚储水能力强',
        '叶面可以喷水清洁',
        '适合桌面养护'
      ]
    },
    {
      id: 'aloe',
      name: '芦荟',
      latin: 'Aloe vera',
      family: '阿福花科',
      category: '多肉',
      emoji: '🌿',
      image: '/images/plants/aloe.png',
      care: {
        light: '明亮散射光到直射光',
        waterDays: 14,
        waterAmount: '浇透等干透',
        temperature: '10-35°C',
        humidity: '30-50%',
        soil: '砂质排水好的土',
        fertilizer: '春夏少量',
        difficulty: '简单',
        toxicity: '可外用，内服需谨慎'
      },
      tips: [
        '叶肉可以护肤',
        '侧芽会不断冒出来可以分盆',
        '冬季控水'
      ]
    },
    {
      id: 'strawberry',
      name: '草莓',
      latin: 'Fragaria × ananassa',
      family: '蔷薇科',
      category: '蔬果',
      emoji: '🍓',
      image: '/images/plants/strawberry.png',
      care: {
        light: '充足光照（6h+）',
        waterDays: 2,
        waterAmount: '保持湿润不积水',
        temperature: '15-25°C',
        humidity: '50-70%',
        soil: '微酸性营养土',
        fertilizer: '花期磷钾肥，忌氮肥过多',
        difficulty: '中等',
        toxicity: '果实可食'
      },
      tips: [
        '用匍匐茎繁殖很方便',
        '果实不要接触土壤',
        '阳台可用吊盆种植'
      ]
    },
    {
      id: 'chili',
      name: '辣椒',
      latin: 'Capsicum',
      family: '茄科',
      category: '蔬果',
      emoji: '🌶️',
      image: '/images/plants/chili.png',
      care: {
        light: '充足直射光',
        waterDays: 3,
        waterAmount: '浇透',
        temperature: '20-35°C',
        humidity: '40-60%',
        soil: '肥沃疏松营养土',
        fertilizer: '结果期每周施肥',
        difficulty: '简单',
        toxicity: '果实可食'
      },
      tips: [
        '盆栽选矮生品种',
        '观赏辣椒五颜六色很好看',
        '自花授粉，阳台也能结果'
      ]
    },
    {
      id: 'peace-lily',
      name: '白掌/一帆风顺',
      latin: 'Spathiphyllum',
      family: '天南星科',
      category: '花卉',
      emoji: '🤍',
      image: '/images/plants/peace-lily.png',
      care: {
        light: '耐阴，散射光即可',
        waterDays: 5,
        waterAmount: '浇透',
        temperature: '18-30°C',
        humidity: '60-80%',
        soil: '疏松保湿营养土',
        fertilizer: '春夏每月一次',
        difficulty: '简单',
        toxicity: '汁液有毒'
      },
      tips: [
        '叶片下垂是缺水信号',
        '净化空气效果很好',
        '白色花亭非常优雅'
      ]
    },
    {
      id: 'jade-plant',
      name: '玉树/景天树',
      latin: 'Crassula ovata',
      family: '景天科',
      category: '多肉',
      emoji: '💎',
      image: '/images/plants/jade-plant.png',
      care: {
        light: '充足光照',
        waterDays: 14,
        waterAmount: '浇透等干透',
        temperature: '10-32°C',
        humidity: '30-50%',
        soil: '颗粒土为主',
        fertilizer: '春夏少量',
        difficulty: '简单',
        toxicity: '微毒'
      },
      tips: [
        '可以养很多年变老桩',
        '秋冬温差大容易开花',
        '修剪可以造型'
      ]
    },
    {
      id: 'basil',
      name: '罗勒/九层塔',
      latin: 'Ocimum basilicum',
      family: '唇形科',
      category: '香草',
      emoji: '🃏',
      image: '/images/plants/basil.png',
      care: {
        light: '充足光照（6h+）',
        waterDays: 2,
        waterAmount: '保持湿润',
        temperature: '20-30°C',
        humidity: '50-70%',
        soil: '肥沃营养土',
        fertilizer: '每两周一次',
        difficulty: '简单',
        toxicity: '可食用'
      },
      tips: [
        '摘心促进分枝',
        '开花后会变苦，及时掐花',
        '做意大利菜必备'
      ]
    },
    {
      id: 'anthurium',
      name: '红掌/花烛',
      latin: 'Anthurium andraeanum',
      family: '天南星科',
      category: '花卉',
      emoji: '❤️',
      image: '/images/plants/anthurium.png',
      care: {
        light: '明亮散射光',
        waterDays: 5,
        waterAmount: '浇透',
        temperature: '20-30°C',
        humidity: '60-80%',
        soil: '疏松透气偏酸性',
        fertilizer: '每月一次稀薄液肥',
        difficulty: '中等',
        toxicity: '汁液有毒'
      },
      tips: [
        '花期超长，一朵花可持续数月',
        '喜欢高湿度，可叶面喷水',
        '红色佛焰苞非常喜庆'
      ]
    }
  ],

  // 分类列表
  categories: [
    { id: 'all', name: '全部', emoji: '🌱' },
    { id: '绿植', name: '绿植', emoji: '🪴' },
    { id: '花卉', name: '花卉', emoji: '🌸' },
    { id: '多肉', name: '多肉', emoji: '🌵' },
    { id: '香草', name: '香草', emoji: '🌿' },
    { id: '蔬果', name: '蔬果', emoji: '🍅' }
  ],

  // 养护任务类型
  taskTypes: [
    { id: 'water', name: '浇水', emoji: '💧', color: '#E3F2FD' },
    { id: 'fertilize', name: '施肥', emoji: '🧪', color: '#E8F5E9' },
    { id: 'prune', name: '修剪', emoji: '✂️', color: '#F1F8E9' },
    { id: 'repot', name: '换盆', emoji: '🏺', color: '#F3E5F5' },
    { id: 'spray', name: '喷药', emoji: '💉', color: '#E8F5E9' }
  ]
}
