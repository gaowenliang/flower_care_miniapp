// cloud/functions/identifyPlant/index.js
// 云函数：AI 植物识别（百度API）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'G4M1FtQWoshDHuaHP8CXydz1'
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || 'LD0Hb9NBxxi96krTUcSfkYepuvAxAa0U'

async function getBaiduToken() {
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
    }).on('error', (e) => { console.error('getBaiduToken error:', e); resolve(null) })
  })
}

exports.main = async (event) => {
  const { imageData } = event

  if (!imageData) {
    return { success: false, error: '缺少图片数据' }
  }

  try {
    // 1. 获取 token
    const token = await getBaiduToken()
    if (!token) {
      return { success: false, error: '百度AI服务获取token失败，请检查API Key' }
    }

    // 2. 调用植物识别 — 使用 form-urlencoded 格式
    const querystring = require('querystring')
    const postData = querystring.stringify({
      image: imageData,
      baike_num: 3
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

    // 检查百度API错误
    if (result.error_code) {
      console.error('百度API错误:', result.error_code, result.error_msg)
      return { success: false, error: `百度API错误: ${result.error_msg || result.error_code}` }
    }

    if (result.result && result.result.length > 0) {
      const plants = result.result.map(r => ({
        name: r.name || '未知',
        score: (r.score * 100).toFixed(1),
        baikeUrl: (r.baike_info && r.baike_info.baike_url) || '',
        description: (r.baike_info && r.baike_info.description) || '',
        image: (r.baike_info && r.baike_info.image_url) || ''
      }))
      return { success: true, plants }
    }

    return { success: false, error: '未识别到植物，请换个角度再试' }
  } catch (err) {
    console.error('植物识别失败:', err)
    return { success: false, error: err.message }
  }
}
