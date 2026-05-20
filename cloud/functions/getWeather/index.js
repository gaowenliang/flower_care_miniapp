// cloud/functions/getWeather/index.js
// 云函数：代理高德天气请求（API Key 不暴露给客户端）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const AMAP_KEY = process.env.AMAP_KEY || 'de9c6192fc5bc7a1e4dfa319f6c26ee8'

exports.main = async (event) => {
  const { city } = event
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${city || '310000'}&extensions=base`

  try {
    const res = await new Promise((resolve, reject) => {
      const http = require('http')
      http.get(url, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    if (res && res.lives && res.lives[0]) {
      return { success: true, weather: res.lives[0] }
    }
    return { success: false, weather: null }
  } catch (err) {
    console.error('天气请求失败:', err)
    return { success: false, weather: null }
  }
}
