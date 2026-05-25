// cloud/functions/getWeather/index.js
// 云函数：代理高德天气请求（API Key 不暴露给客户端）
// 支持传入 adcode / 经纬度 / 城市名，内部统一转为 adcode
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AMAP_KEY = process.env.AMAP_KEY || 'de9c6192fc5bc7a1e4dfa319f6c26ee8'

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const http = require('http')
    http.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

// 主要城市名 → adcode 映射
const CITY_CODE_MAP = {
  '北京': '110000', '北京市': '110000', '上海': '310000', '上海市': '310000',
  '广州': '440100', '广州市': '440100', '深圳': '440300', '深圳市': '440300',
  '杭州': '330100', '杭州市': '330100', '成都': '510100', '成都市': '510100',
  '武汉': '420100', '武汉市': '420100', '南京': '320100', '南京市': '320100',
  '重庆': '500000', '天津市': '120000', '西安': '610100', '西安市': '610100',
  '苏州': '320500', '长沙市': '430100', '郑州市': '410100', '青岛市': '370200',
  '大连市': '210200', '厦门市': '350200', '昆明市': '530100', '合肥市': '340100',
  '福州市': '350100', '济南市': '370100', '沈阳市': '210100', '哈尔滨市': '230100',
  '长春市': '220100', '石家庄市': '130100', '太原市': '140100', '南宁市': '450100',
  '贵阳市': '520100', '兰州市': '620100', '海口市': '460100', '银川市': '640100',
  '西宁市': '630100', '呼和浩特市': '150100', '乌鲁木齐市': '650100', '拉萨市': '540100',
  '无锡市': '320200', '宁波市': '330200', '温州市': '330300', '东莞市': '441900',
  '佛山市': '440600', '珠海市': '440400', '惠州市': '441300', '中山市': '442000',
  '南通市': '320600', '常州市': '320400', '徐州市': '320300', '扬州市': '321000',
  '嘉兴市': '330400', '金华市': '330700', '绍兴市': '330600', '台州市': '331000',
  '泉州市': '350500', '漳州市': '350600', '烟台市': '370600', '潍坊市': '370700',
  '临沂市': '371300', '保定市': '130600', '唐山市': '130200', '洛阳市': '410300',
  '宜昌市': '420500', '襄阳市': '420600', '岳阳市': '430600', '绵阳市': '510700',
  '桂林市': '450300', '三亚市': '460200'
}

async function resolveAdcode(city) {
  if (!city) return '310000'

  // 已经是纯数字 adcode（6位）
  if (/^\d{6}$/.test(city)) return city

  // 经纬度格式（包含逗号）— 逆地理解码
  if (city.includes(',')) {
    try {
      const geoRes = await httpGet(`https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${city}`)
      if (geoRes && geoRes.regeocode && geoRes.regeocode.addressComponent) {
        return geoRes.regeocode.addressComponent.adcode || '310000'
      }
    } catch (e) {
      console.error('逆地理解码失败:', e)
    }
    return '310000'
  }

  // 中文城市名 — 查映射表
  if (CITY_CODE_MAP[city]) return CITY_CODE_MAP[city]

  // 映射表没命中，尝试高德地理编码
  try {
    const geoRes = await httpGet(`https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(city)}`)
    if (geoRes && geoRes.geocodes && geoRes.geocodes[0] && geoRes.geocodes[0].adcode) {
      return geoRes.geocodes[0].adcode
    }
  } catch (e) {
    console.error('城市名编码失败:', e)
  }

  // 全部失败，fallback 上海
  return '310000'
}

exports.main = async (event) => {
  try {
    const adcode = await resolveAdcode(event.city)
    const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${adcode}&extensions=base`
    const res = await httpGet(url)

    if (res && res.lives && res.lives[0]) {
      return { success: true, weather: res.lives[0] }
    }
    return { success: false, weather: null }
  } catch (err) {
    console.error('天气请求失败:', err)
    return { success: false, weather: null }
  }
}
