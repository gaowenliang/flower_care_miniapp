// utils/smart-tips.js — 智能贴士：结合天气、季节、位置生成养护建议

const storage = require('./storage')

// 季节判定
function getSeason(month) {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const SEASON_NAMES = { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' }

// 天气匹配规则库 — 每种植物按 [季节][条件] 组织
// 条件：hot(>30) / warm(20-30) / cool(10-20) / cold(<10) / humid(>80) / dry(<30) / rain / sunny / default
const TIP_RULES = {
  // 通用规则（所有植物适用）
  _common: {
    spring: {
      default: ['春天是生长旺季，可以适当增加浇水频率', '适合换盆换土，给植物新的营养', '可以开始施肥，薄肥勤施'],
      sunny: ['春日阳光温和，多让植物晒太阳', '光照充足有利于新芽萌发'],
      rain: ['连续阴雨天减少浇水', '注意通风防病虫害']
    },
    summer: {
      hot: ['高温天气避免正午浇水，选早晚进行', '注意遮阳防晒，避免叶片灼伤', '空调房内注意保持湿度'],
      humid: ['湿度大时减少浇水频率', '注意通风，防止闷根和病害'],
      dry: ['空气干燥时可以向叶面喷水增湿', '盆土干得快，注意增加浇水频次'],
      default: ['夏季生长旺盛，注意水肥管理', '高温期部分植物休眠，需控水']
    },
    autumn: {
      default: ['秋天是第二个生长季，可以追肥', '逐渐减少浇水频率', '准备入冬，减少氮肥增施磷钾肥'],
      cool: ['气温下降，减少浇水频率', '准备将室外植物移入室内'],
      sunny: ['秋高气爽，多晒太阳有利于植物积累养分']
    },
    winter: {
      cold: ['注意保暖防冻，远离冷风口', '减少浇水，盆土偏干为好', '停止施肥，让植物休眠'],
      default: ['冬季植物生长缓慢，控水控肥', '保持充足光照', '远离暖气片和空调出风口']
    }
  }
}

// 植物特性关键词 → 季节+天气补充建议
const PLANT_TRAITS = {
  '耐阴': { summer: { hot: ['耐阴植物夏天也要避免暴晒'] } },
  '喜阳': { winter: { cold: ['喜阳植物冬天需要尽量多晒太阳', '可以补光灯辅助'] } },
  '耐旱': { summer: { humid: ['耐旱植物湿度大时更要控水，防烂根'] } },
  '喜湿': { summer: { hot: ['喜湿植物高温天可以每天喷水', '托盘加水保持环境湿度'] } },
  '多肉': { summer: { default: ['多肉夏季休眠，严格控水', '避免淋雨，保持通风'] } },
  '热带': { winter: { cold: ['热带植物低于10°C容易冻伤，注意保温', '可以用塑料袋套住保温'] } },
  '开花': { spring: { default: ['花期前增施磷钾肥促花'] }, autumn: { default: ['花后修剪残花，减少养分消耗'] } },
  '爬藤': { spring: { default: ['春季是攀爬生长旺季，及时引导攀附'] } },
  '香草': { summer: { default: ['香草夏天长得快，勤采摘促分枝'] } },
  '蔬果': { spring: { default: ['春季播种/移栽的好时机'] }, summer: { hot: ['蔬果结果期需要充足水分'] } }
}

// 位置相关建议
const LOCATION_TIPS = {
  '阳台': {
    summer: { hot: ['阳台夏天温度高，中午拉遮阳网'] },
    winter: { cold: ['封闭阳台保温效果好，开放阳台注意防风'] }
  },
  '室内': {
    default: ['室内养护注意定期通风', '远离空调出风口和暖气片'],
    winter: { default: ['室内有暖气，注意增加空气湿度'] }
  },
  '花园': {
    spring: { default: ['春天适合户外移栽和播种'] },
    summer: { hot: ['户外植物高温天可以搭遮阳网'] },
    winter: { cold: ['地栽植物根部覆盖 mulch 防冻'] }
  },
  '窗台': {
    default: ['窗台光照好但温差大，注意调节'],
    winter: { cold: ['窗户附近温度低，夜间可以拉窗帘保温'] }
  }
}

/**
 * 获取天气信息
 * 优先走云函数代理（Key不暴露），降级直接请求（开发阶段）
 */
function fetchWeather(city) {
  return new Promise((resolve) => {
    // 优先云函数
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'getWeather',
        data: { city: city || wx.getStorageSync('_weather_city') || '310000' },
        success: (res) => {
          if (res.result && res.result.success && res.result.weather) {
            resolve(res.result.weather)
          } else {
            resolve(null)
          }
        },
        fail: () => {
          // 云函数失败，降级直接请求（开发阶段保留）
          fetchWeatherDirect(city).then(resolve)
        }
      })
    } else {
      fetchWeatherDirect(city).then(resolve)
    }
  })
}

function fetchWeatherDirect(city) {
  // 前端不再直连高德API，避免暴露Key
  // 如果云函数不可用，返回null让贴士降级为纯季节建议
  return Promise.resolve(null)
}

/**
 * 根据天气数据判断条件标签
 */
function getWeatherConditions(weather) {
  if (!weather) return ['default']
  const conditions = []
  const temp = parseInt(weather.temperature) || 20
  const humidity = parseInt(weather.humidity) || 50
  const weatherText = (weather.weather || '').toLowerCase()

  if (temp >= 30) conditions.push('hot')
  else if (temp >= 20) conditions.push('warm')
  else if (temp >= 10) conditions.push('cool')
  else conditions.push('cold')

  if (humidity >= 80) conditions.push('humid')
  else if (humidity <= 30) conditions.push('dry')

  if (weatherText.includes('雨') || weatherText.includes('阴')) conditions.push('rain')
  if (weatherText.includes('晴')) conditions.push('sunny')

  return conditions
}

/**
 * 获取植物标签（用于匹配特性规则）
 */
function getPlantTags(plantInfo) {
  const tags = []
  if (!plantInfo || !plantInfo.care) return tags

  const care = plantInfo.care
  if (care.light && care.light.includes('阴')) tags.push('耐阴')
  if (care.light && (care.light.includes('充足') || care.light.includes('直射'))) tags.push('喜阳')
  if (care.waterDays >= 10) tags.push('耐旱')
  if (care.waterDays <= 3) tags.push('喜湿')
  if (plantInfo.category === '多肉') tags.push('多肉')
  if (care.temperature && care.temperature.includes('热带')) tags.push('热带')
  if (care.temperature && (care.temperature.includes('不低于') || care.temperature.includes('10'))) tags.push('热带')
  if (plantInfo.category === '花卉' || (plantInfo.name && plantInfo.name.includes('花'))) tags.push('开花')
  if (plantInfo.name && (plantInfo.name.includes('藤') || plantInfo.name.includes('萝'))) tags.push('爬藤')
  if (plantInfo.category === '香草') tags.push('香草')
  if (plantInfo.category === '蔬果') tags.push('蔬果')

  return tags
}

/**
 * 从规则库中随机选取 N 条贴士
 */
function pickTips(ruleSet, conditions, count) {
  const pool = []
  for (const cond of conditions) {
    if (ruleSet[cond]) {
      pool.push(...ruleSet[cond])
    }
  }
  if (pool.length === 0 && ruleSet['default']) {
    pool.push(...ruleSet['default'])
  }
  // 去重并随机取 count 条
  const unique = [...new Set(pool)]
  const result = []
  const used = new Set()
  while (result.length < count && result.length < unique.length) {
    const idx = Math.floor(Math.random() * unique.length)
    if (!used.has(idx)) {
      used.add(idx)
      result.push(unique[idx])
    }
  }
  return result
}

/**
 * 清理过期的智能贴士缓存（只保留当天的）
 */
function cleanOldCache(todayStr) {
  try {
    const info = wx.getStorageInfoSync()
    info.keys.forEach(key => {
      if (key.startsWith('smartTips_') && !key.includes(todayStr)) {
        wx.removeStorageSync(key)
      }
    })
  } catch (e) {
    // ignore
  }
}

/**
 * 生成智能贴士（主入口）
 * @param {Object} plantInfo  植物数据库中的信息
 * @param {string} location   养护位置（阳台/室内/花园/窗台）
 * @param {string} city       城市编码（高德adcode）
 * @returns {Promise<Array>}  贴士数组
 */
async function generateSmartTips(plantInfo, location, city) {
  const now = new Date()
  const season = getSeason(now.getMonth() + 1)
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`

  // 清理过期缓存（非当天的）
  cleanOldCache(dateStr)

  // 检查缓存
  const cacheKey = `smartTips_${(plantInfo && plantInfo.id) || 'custom'}_${dateStr}`
  try {
    const cached = wx.getStorageSync(cacheKey)
    if (cached && cached.length > 0) return cached
  } catch (e) {}

  // 获取天气
  const weather = await fetchWeather(city)
  const conditions = getWeatherConditions(weather)
  const tags = getPlantTags(plantInfo)

  const tips = []

  // 1. 天气+季节通用贴士（2条）
  const commonRules = TIP_RULES._common[season]
  if (commonRules) {
    tips.push(...pickTips(commonRules, conditions, 2))
  }

  // 2. 植物特性贴士（2条）
  for (const tag of tags) {
    const traitRules = PLANT_TRAITS[tag]
    if (traitRules && traitRules[season]) {
      tips.push(...pickTips(traitRules[season], conditions, 2))
    }
  }

  // 3. 位置贴士（1条）
  const locKey = location || '室内'
  const locRules = LOCATION_TIPS[locKey] || LOCATION_TIPS['室内']
  if (locRules) {
    const seasonLoc = locRules[season] || locRules['default']
    if (seasonLoc) {
      tips.push(...pickTips(
        Array.isArray(seasonLoc) ? { default: seasonLoc } : seasonLoc,
        conditions, 1
      ))
    }
  }

  // 4. 原始贴士补充（如果不够5条）
  if (tips.length < 3 && plantInfo && plantInfo.tips) {
    const remaining = plantInfo.tips.filter(t => !tips.includes(t))
    tips.push(...remaining.slice(0, 3 - tips.length))
  }

  // 去重、截取
  const finalTips = [...new Set(tips)].slice(0, 5)

  // 缓存（当天有效）
  try {
    wx.setStorageSync(cacheKey, finalTips)
  } catch (e) {}

  // 附带天气摘要
  const weatherSummary = weather
    ? `${SEASON_NAMES[season]} · ${weather.weather} ${weather.temperature}°C`
    : `${SEASON_NAMES[season]}`

  return {
    tips: finalTips,
    weather: weatherSummary,
    season: SEASON_NAMES[season],
    date: dateStr
  }
}

module.exports = {
  generateSmartTips,
  getSeason,
  SEASON_NAMES
}
