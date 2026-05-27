// cloud/functions/getWeather/index.js
const cloud = require('wx-server-sdk')
const http = require('http')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AMAP_KEY = process.env.AMAP_KEY

function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { req.destroy(); reject(new Error('请求超时')) }, timeoutMs)
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

const CITY_CODE_MAP = {
  '北京': '110000', '北京市': '110000', '上海': '310000', '上海市': '310000',
  '广州': '440100', '深圳': '440300', '杭州': '330100', '成都': '510100',
  '武汉': '420100', '南京': '320100', '重庆': '500000'
}

async function resolveAdcode(city) {
  if (!city) return '310000'
  if (/^\d{6}$/.test(city)) return city
  if (city.includes(',')) {
    try {
      const geoRes = await httpGet(`https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${city}`)
      if (geoRes && geoRes.regeocode && geoRes.regeocode.addressComponent) {
        return geoRes.regeocode.addressComponent.adcode || '310000'
      }
    } catch (e) { console.error('逆地理解码失败:', e) }
    return '310000'
  }
  if (CITY_CODE_MAP[city]) return CITY_CODE_MAP[city]
  try {
    const geoRes = await httpGet(`https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(city)}`)
    if (geoRes && geoRes.geocodes && geoRes.geocodes[0]) return geoRes.geocodes[0].adcode
  } catch (e) { console.error('城市名编码失败:', e) }
  return '310000'
}

exports.main = async (event) => {
  if (!AMAP_KEY) return { success: false, error: '高德 API 未配置，请设置环境变量 AMAP_KEY' }
  try {
    const adcode = await resolveAdcode(event.city)
    const res = await httpGet(`https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${adcode}&extensions=base`)
    if (res && res.lives && res.lives[0]) return { success: true, weather: res.lives[0] }
    return { success: false, weather: null }
  } catch (err) {
    console.error('天气请求失败:', err)
    return { success: false, error: err.message }
  }
}
