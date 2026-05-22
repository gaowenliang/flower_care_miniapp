// cloud/functions/identifyPlant/index.js
// 云函数：AI 植物识别（百度API）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 百度AI植物识别 — 需要在云函数环境变量配置 BAIDU_TOKEN
// 或使用 AccessToken 自动获取
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'G4M1FtQWoshDHuaHP8CXydz1'
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'LD0Hb9NBxxi96krTUcSfkYepuvAxAa0U'

async function getBaiduToken() {
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) return null
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
  
  return new Promise((resolve) => {
    const https = require('https')
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.access_token || null)
        } catch (e) { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
}

exports.main = async (event) => {
  const { imageData } = event // base64图片数据
  
  if (!imageData) {
    return { success: false, error: '缺少图片数据' }
  }

  try {
    const token = await getBaiduToken()
    if (!token) {
      return { success: false, error: 'AI服务未配置，请联系管理员' }
    }

    // 百度植物识别API
    const postData = JSON.stringify({
      image: imageData,
      baike_num: 3 // 返回3个候选结果
    })

    const result = await new Promise((resolve, reject) => {
      const https = require('https')
      const options = {
        hostname: 'aip.baidubce.com',
        path: `/rest/2.0/image-classify/v1/plant?access_token=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    if (result.result && result.result.length > 0) {
      const plants = result.result.map(r => ({
        name: r.name || '未知',
        score: (r.score * 100).toFixed(1),
        baikeUrl: r.baike_info?.baike_url || '',
        description: r.baike_info?.description || '',
        image: r.baike_info?.image_url || ''
      }))
      return { success: true, plants }
    }

    return { success: false, error: '未识别到植物，请换个角度再试' }
  } catch (err) {
    console.error('植物识别失败:', err)
    return { success: false, error: err.message }
  }
}
