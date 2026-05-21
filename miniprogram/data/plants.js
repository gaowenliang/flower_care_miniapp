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
      emoji: '🪸',
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
      emoji: '🪻',
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
      emoji: '🌾',
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
    },
    // ===== 新增植物 20-50 =====
    {
      id: 'rubber-tree',
      name: '橡皮树',
      latin: 'Ficus elastica',
      family: '桑科',
      category: '绿植',
      emoji: '🛢️',
      care: { light: '明亮散射光', waterDays: 7, waterAmount: '浇透等干', temperature: '15-28°C', humidity: '50-70%', soil: '疏松透气营养土', fertilizer: '春夏每月一次', difficulty: '简单', toxicity: '汁液微毒' },
      tips: ['叶片油亮有光泽，可定期擦拭', '耐阴能力较强', '修剪可促进分枝']
    },
    {
      id: 'peace-lily-2',
      name: '吊兰',
      latin: 'Chlorophytum comosum',
      family: '天门冬科',
      category: '绿植',
      emoji: '🎈',
      care: { light: '散射光到半阴', waterDays: 5, waterAmount: '浇透', temperature: '15-30°C', humidity: '40-60%', soil: '普通营养土', fertilizer: '春夏每月一次', difficulty: '超简单', toxicity: '无毒' },
      tips: ['净化空气效果极佳', '匍匐茎上会长小吊兰，可以剪下繁殖', '叶片发黄多为光照不足']
    },
    {
      id: 'syngonium',
      name: '箭叶芋/合果芋',
      latin: 'Syngonium podophyllum',
      family: '天南星科',
      category: '绿植',
      emoji: '🏹',
      care: { light: '散射光', waterDays: 5, waterAmount: '浇透', temperature: '18-30°C', humidity: '60-80%', soil: '疏松营养土', fertilizer: '春夏每月一次', difficulty: '超简单', toxicity: '汁液微毒' },
      tips: ['叶片形状会随生长变化', '可以攀爬也可以垂吊', '品种很多，白蝶合果芋最受欢迎']
    },
    {
      id: 'calathea',
      name: '竹芋',
      latin: 'Calathea',
      family: '竹芋科',
      category: '绿植',
      emoji: '🎯',
      care: { light: '明亮散射光', waterDays: 4, waterAmount: '保持湿润', temperature: '18-28°C', humidity: '70-90%', soil: '疏松保湿营养土', fertilizer: '春夏每月一次', difficulty: '中等', toxicity: '无毒' },
      tips: ['对湿度要求很高', '叶片会在夜间合拢，白天展开', '用纯净水或放置过的自来水浇']
    },
    {
      id: 'philodendron',
      name: '蔓绿绒',
      latin: 'Philodendron',
      family: '天南星科',
      category: '绿植',
      emoji: '🦎',
      care: { light: '散射光', waterDays: 6, waterAmount: '浇透等干', temperature: '18-30°C', humidity: '50-70%', soil: '疏松透气营养土', fertilizer: '春夏每月一次', difficulty: '简单', toxicity: '汁液微毒' },
      tips: ['品种超级多，颜值都很高', '可以攀爬苔藓柱', '生长速度较快']
    },
    {
      id: 'dracaena',
      name: '龙血树/富贵竹',
      latin: 'Dracaena',
      family: '天门冬科',
      category: '绿植',
      emoji: '🎋',
      care: { light: '明亮散射光', waterDays: 7, waterAmount: '浇透等干', temperature: '15-30°C', humidity: '40-60%', soil: '疏松营养土', fertilizer: '春夏每月一次', difficulty: '简单', toxicity: '汁液微毒' },
      tips: ['水培也很常见，每周换水', '富贵竹寓意好，很受欢迎', '叶尖干枯多为空气太干']
    },
    {
      id: 'spider-plant',
      name: '常春藤',
      latin: 'Hedera helix',
      family: '五加科',
      category: '绿植',
      emoji: '🍀',
      care: { light: '散射光到半阴', waterDays: 5, waterAmount: '浇透', temperature: '10-25°C', humidity: '50-70%', soil: '疏松营养土', fertilizer: '春夏每月一次', difficulty: '简单', toxicity: '汁液微毒' },
      tips: ['耐寒能力较强', '净化空气效果好', '可以做垂吊植物']
    },
    {
      id: 'pilea',
      name: '镜面草/铜钱草',
      latin: 'Pilea peperomioides',
      family: '荨麻科',
      category: '绿植',
      emoji: '🪙',
      care: { light: '明亮散射光', waterDays: 4, waterAmount: '保持湿润', temperature: '15-28°C', humidity: '50-70%', soil: '疏松营养土', fertilizer: '春夏每月一次', difficulty: '简单', toxicity: '无毒' },
      tips: ['圆形叶片像小荷叶很可爱', '会长侧芽可以分盆', '半水培也可以']
    },
    {
      id: 'aglaonema',
      name: '粗肋草/万年青',
      latin: 'Aglaonema',
      family: '天南星科',
      category: '绿植',
      emoji: '🎭',
      care: { light: '耐阴，散射光', waterDays: 7, waterAmount: '浇透等干', temperature: '18-30°C', humidity: '50-70%', soil: '疏松营养土', fertilizer: '春夏每月一次', difficulty: '超简单', toxicity: '汁液微毒' },
      tips: ['超级耐阴，适合光线不好的房间', '品种多，红粉 champion 很漂亮', '非常好养的新手植物']
    },
    {
      id: 'yucca',
      name: '丝兰',
      latin: 'Yucca elephantipes',
      family: '天门冬科',
      category: '绿植',
      emoji: '🌴',
      care: { light: '充足光照', waterDays: 10, waterAmount: '浇透等干透', temperature: '10-35°C', humidity: '30-50%', soil: '疏松砂质土', fertilizer: '春夏少量', difficulty: '简单', toxicity: '微毒' },
      tips: ['外形像小型棕榈树', '非常耐旱', '适合客厅大盆栽']
    },
    {
      id: 'hydrangea',
      name: '绣球花',
      latin: 'Hydrangea',
      family: '绣球花科',
      category: '花卉',
      emoji: '💙',
      care: { light: '半阴到散射光', waterDays: 2, waterAmount: '保持湿润', temperature: '15-28°C', humidity: '60-80%', soil: '微酸性营养土', fertilizer: '花期磷钾肥', difficulty: '中等', toxicity: '有毒' },
      tips: ['花朵超大，颜色随土壤酸碱变化', '酸性土开蓝花，碱性土开粉花', '需要大量水分，夏天可能一天浇两次']
    },
    {
      id: 'jasmine',
      name: '茉莉花',
      latin: 'Jasminum',
      family: '木犀科',
      category: '花卉',
      emoji: '🌙',
      care: { light: '充足直射光', waterDays: 2, waterAmount: '浇透', temperature: '20-35°C', humidity: '50-70%', soil: '微酸性营养土', fertilizer: '花期每周磷钾肥', difficulty: '中等', toxicity: '无毒' },
      tips: ['花香浓郁，可做花茶', '花后修剪促进复花', '喜欢阳光和水分']
    },
    {
      id: 'sunflower',
      name: '向日葵',
      latin: 'Helianthus annuus',
      family: '菊科',
      category: '花卉',
      emoji: '🌻',
      care: { light: '充足直射光（8h+）', waterDays: 2, waterAmount: '浇透', temperature: '20-35°C', humidity: '40-60%', soil: '肥沃疏松营养土', fertilizer: '生长期每周施肥', difficulty: '简单', toxicity: '无毒' },
      tips: ['朝阳特性，花盘会追着太阳转', '矮生品种适合阳台', '播种到开花约60天']
    },
    {
      id: 'camellia',
      name: '山茶花',
      latin: 'Camellia',
      family: '山茶科',
      category: '花卉',
      emoji: '🏵️',
      care: { light: '半阴到散射光', waterDays: 4, waterAmount: '浇透', temperature: '10-25°C', humidity: '60-80%', soil: '酸性营养土', fertilizer: '花后施一次有机肥', difficulty: '中等', toxicity: '无毒' },
      tips: ['冬季开花，花期很长', '需要酸性土壤', '花蕾期不要移动位置']
    },
    {
      id: 'gardenia',
      name: '栀子花',
      latin: 'Gardenia jasminoides',
      family: '茜草科',
      category: '花卉',
      emoji: '🧊',
      care: { light: '充足散射光', waterDays: 3, waterAmount: '保持湿润', temperature: '18-28°C', humidity: '60-80%', soil: '酸性营养土', fertilizer: '生长期每两周施硫酸亚铁', difficulty: '较难', toxicity: '无毒' },
      tips: ['花香非常好闻', '对土壤酸碱度很敏感', '黄叶多为缺铁或土壤偏碱']
    },
    {
      id: 'tulip',
      name: '郁金香',
      latin: 'Tulipa',
      family: '百合科',
      category: '花卉',
      emoji: '🌷',
      care: { light: '充足光照', waterDays: 5, waterAmount: '浇透等干', temperature: '10-20°C', humidity: '40-60%', soil: '疏松排水好的土', fertilizer: '种植时加底肥', difficulty: '中等', toxicity: '鳞茎有毒' },
      tips: ['需要低温春化才能开花', '花盆种植选矮生品种', '花后剪掉花茎保留叶片养球']
    },
    {
      id: 'echeveria',
      name: '石莲花/吉娃娃',
      latin: 'Echeveria',
      family: '景天科',
      category: '多肉',
      emoji: '🪷',
      care: { light: '充足直射光', waterDays: 14, waterAmount: '浇透等干透', temperature: '10-35°C', humidity: '20-40%', soil: '颗粒土为主', fertilizer: '春秋少量', difficulty: '简单', toxicity: '无毒' },
      tips: ['光照不足会徒长变丑', '叶片上有白粉不要擦', '叶插繁殖非常容易']
    },
    {
      id: 'sedum',
      name: '佛甲草/垂盆草',
      latin: 'Sedum',
      family: '景天科',
      category: '多肉',
      emoji: '🥬',
      care: { light: '充足光照', waterDays: 10, waterAmount: '浇透等干', temperature: '5-35°C', humidity: '20-40%', soil: '砂质土', fertilizer: '少量即可', difficulty: '超简单', toxicity: '无毒' },
      tips: ['超级好养，几乎死不了', '可以铺面做地被', '开小黄花很可爱']
    },
    {
      id: 'haworthia',
      name: '玉露/十二卷',
      latin: 'Haworthia',
      family: '阿福花科',
      category: '多肉',
      emoji: '🔮',
      care: { light: '明亮散射光', waterDays: 10, waterAmount: '浇透等干透', temperature: '10-30°C', humidity: '30-50%', soil: '颗粒土为主', fertilizer: '春秋少量', difficulty: '简单', toxicity: '无毒' },
      tips: ['叶片顶部有透明窗', '不要暴晒，散射光最好', '闷养可以让窗更透亮']
    },
    {
      id: 'ceropegia',
      name: '爱之蔓',
      latin: 'Ceropegia woodii',
      family: '夹竹桃科',
      category: '多肉',
      emoji: '💝',
      care: { light: '明亮散射光', waterDays: 10, waterAmount: '浇透等干透', temperature: '15-28°C', humidity: '30-50%', soil: '颗粒土为主', fertilizer: '春夏少量', difficulty: '简单', toxicity: '无毒' },
      tips: ['心形叶片，适合送人', '垂吊种植很好看', '会长小土豆可以繁殖']
    },
    {
      id: 'sansevieria-hahnii',
      name: '短叶虎皮兰/鸟巢虎皮兰',
      latin: 'Sansevieria hahnii',
      family: '天门冬科',
      category: '绿植',
      emoji: '📎',
      care: { light: '耐阴到明亮光', waterDays: 14, waterAmount: '浇透等干透', temperature: '10-35°C', humidity: '30-50%', soil: '疏松砂质土', fertilizer: '春夏少量', difficulty: '超简单', toxicity: '微毒' },
      tips: ['矮生品种，适合桌面', '非常好养', '净化空气效果极佳']
    },
    {
      id: 'rosemary',
      name: '迷迭香',
      latin: 'Rosmarinus officinalis',
      family: '唇形科',
      category: '香草',
      emoji: '🧂',
      care: { light: '充足直射光（6h+）', waterDays: 4, waterAmount: '浇透等干', temperature: '10-30°C', humidity: '30-50%', soil: '疏松排水好的土', fertilizer: '春夏少量', difficulty: '中等', toxicity: '可食用' },
      tips: ['西餐常用香料', '喜欢通风好的环境', '可以扦插繁殖']
    },
    {
      id: 'thyme',
      name: '百里香',
      latin: 'Thymus vulgaris',
      family: '唇形科',
      category: '香草',
      emoji: '🫖',
      care: { light: '充足直射光', waterDays: 5, waterAmount: '浇透等干', temperature: '10-30°C', humidity: '30-50%', soil: '疏松碱性土', fertilizer: '少量即可', difficulty: '简单', toxicity: '可食用' },
      tips: ['可以做菜调味', '地被种植也很好看', '耐旱耐贫瘠']
    },
    {
      id: 'lemon-balm',
      name: '柠檬香蜂草',
      latin: 'Melissa officinalis',
      family: '唇形科',
      category: '香草',
      emoji: '🐝',
      care: { light: '充足光照', waterDays: 3, waterAmount: '保持湿润', temperature: '15-30°C', humidity: '50-70%', soil: '肥沃营养土', fertilizer: '每月一次', difficulty: '超简单', toxicity: '可食用' },
      tips: ['叶片有柠檬香味', '泡茶非常好', '生长很快，定期修剪']
    },
    {
      id: 'blueberry',
      name: '蓝莓',
      latin: 'Vaccinium',
      family: '杜鹃花科',
      category: '蔬果',
      emoji: '🫐',
      care: { light: '充足直射光', waterDays: 3, waterAmount: '保持湿润', temperature: '15-28°C', humidity: '50-70%', soil: '酸性营养土', fertilizer: '春季硫酸亚铁+有机肥', difficulty: '中等', toxicity: '果实可食' },
      tips: ['必须用酸性土', '需要两棵不同品种才能结果好', '盆栽选矮丛品种']
    },
    {
      id: 'lemon',
      name: '柠檬',
      latin: 'Citrus limon',
      family: '芸香科',
      category: '蔬果',
      emoji: '🍋',
      care: { light: '充足直射光（6h+）', waterDays: 4, waterAmount: '浇透', temperature: '18-35°C', humidity: '50-70%', soil: '微酸性营养土', fertilizer: '花期磷钾肥，果期氮肥', difficulty: '中等', toxicity: '果实可食' },
      tips: ['阳台也能种，选矮化砧木', '花期需要人工授粉', '一年可多次开花结果']
    },
    {
      id: 'grape',
      name: '葡萄',
      latin: 'Vitis vinifera',
      family: '葡萄科',
      category: '蔬果',
      emoji: '🍇',
      care: { light: '充足直射光（8h+）', waterDays: 3, waterAmount: '浇透', temperature: '15-35°C', humidity: '40-60%', soil: '肥沃疏松营养土', fertilizer: '果期磷钾肥', difficulty: '中等', toxicity: '果实可食' },
      tips: ['需要搭架子攀爬', '冬季修剪很重要', '阳台可选矮化品种']
    },
    {
      id: 'fig',
      name: '无花果',
      latin: 'Ficus carica',
      family: '桑科',
      category: '蔬果',
      emoji: '🫓',
      care: { light: '充足直射光', waterDays: 4, waterAmount: '浇透', temperature: '15-35°C', humidity: '40-60%', soil: '肥沃疏松营养土', fertilizer: '果期磷钾肥', difficulty: '简单', toxicity: '果实可食' },
      tips: ['不用授粉也能结果', '盆栽选矮生品种', '果实成熟后很快掉落要及时采摘']
    },
    {
      id: 'cilantro',
      name: '香菜/芫荽',
      latin: 'Coriandrum sativum',
      family: '伞形科',
      category: '香草',
      emoji: '🍜',
      care: { light: '充足光照', waterDays: 2, waterAmount: '保持湿润', temperature: '15-25°C', humidity: '50-70%', soil: '肥沃营养土', fertilizer: '每两周一次', difficulty: '简单', toxicity: '可食用' },
      tips: ['不耐热，夏天容易开花', '播种繁殖', '生长周期短，30天可收获']
    },
    {
      id: 'scallion',
      name: '小葱',
      latin: 'Allium fistulosum',
      family: '石蒜科',
      category: '蔬果',
      emoji: '🧅',
      care: { light: '充足光照', waterDays: 3, waterAmount: '浇透', temperature: '10-30°C', humidity: '40-60%', soil: '肥沃营养土', fertilizer: '每月一次', difficulty: '超简单', toxicity: '可食用' },
      tips: ['买来的葱根插土里就能活', '剪了还会继续长', '厨房窗台就可以种']
    },
    {
      id: 'cherry-blossom',
      name: '樱花',
      latin: 'Prunus serrulata',
      family: '蔷薇科',
      category: '花卉',
      emoji: '🌸',
      care: { light: '充足直射光', waterDays: 4, waterAmount: '浇透', temperature: '5-25°C', humidity: '50-70%', soil: '疏松微酸性土', fertilizer: '春秋各一次有机肥', difficulty: '较难', toxicity: '无毒' },
      tips: ['需要低温休眠才能开花', '盆栽选矮化品种', '春季花期短暂但非常美']
    },
    {
      id: 'daisy',
      name: '雏菊',
      latin: 'Bellis perennis',
      family: '菊科',
      category: '花卉',
      emoji: '🌼',
      care: { light: '充足光照', waterDays: 3, waterAmount: '浇透', temperature: '10-25°C', humidity: '50-70%', soil: '肥沃疏松营养土', fertilizer: '花期每两周一次', difficulty: '简单', toxicity: '无毒' },
      tips: ['春秋两季开花', '花后修剪促进复花', '播种繁殖很容易']
    },
    {
      id: 'dahlia',
      name: '大丽花',
      latin: 'Dahlia',
      family: '菊科',
      category: '花卉',
      emoji: '🌺',
      care: { light: '充足光照（6h+）', waterDays: 3, waterAmount: '浇透', temperature: '15-30°C', humidity: '50-70%', soil: '肥沃疏松营养土', fertilizer: '花期磷钾肥', difficulty: '中等', toxicity: '无毒' },
      tips: ['花型花色超级丰富', '块根种植', '需要打顶促进分枝']
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
