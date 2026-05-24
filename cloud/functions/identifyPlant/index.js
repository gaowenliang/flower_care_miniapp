// cloud/functions/identifyPlant/index.js
// 云函数：AI 植物识别（百度API）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''

// 缓存 access_token（有效期30天）
let _tokenCache = { token: null, expiresAt: 0 }

async function getBaiduToken() {
  // 使用缓存的 token
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
  return new Promise((resolve) => {
    const https = require('https')
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.access_token) {
            // 缓存29天
            _tokenCache = { token: json.access_token, expiresAt: Date.now() + 29 * 86400000 }
            resolve(json.access_token)
          } else {
            console.error('百度token响应异常:', data.substring(0, 200))
            resolve(null)
          }
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

  // 检查 API Key 配置
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    return { success: false, error: '百度API未配置，请联系管理员设置环境变量 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' }
  }

  try {
    const token = await getBaiduToken()
    if (!token) {
      return { success: false, error: '百度AI服务获取token失败，请检查API Key配置' }
    }

    const querystring = require('querystring')
    const postData = querystring.stringify({
      image: imageData,
      baike_num: 5
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

    if (result.error_code) {
      console.error('百度API错误:', result.error_code, result.error_msg)
      // 常见错误码友好提示
      const errorMessages = {
        110: 'API Key无效或过期',
        111: 'API Token过期',
        18: 'QPS超限，请稍后再试',
        19: '请求量超限',
        216201: '图片中未检测到植物',
        216202: '图片模糊，请重新拍摄'
      }
      return { success: false, error: errorMessages[result.error_code] || `识别失败(${result.error_code})` }
    }

    if (result.result && result.result.length > 0) {
      const plants = result.result.map(r => ({
        name: r.name || '未知',
        score: (r.score * 100).toFixed(1),
        baikeUrl: (r.baike_info && r.baike_info.baike_url) || '',
        description: (r.baike_info && r.baike_info.description) || '',
        image: (r.baike_info && r.baike_info.image_url) || '',
        // 提取科属信息（从百科描述或名字中解析）
        family: extractFamily(r),
        genus: extractGenus(r)
      }))
      return { success: true, plants }
    }

    return { success: false, error: '未识别到植物，请换个角度再试' }
  } catch (err) {
    console.error('植物识别失败:', err)
    return { success: false, error: '识别服务异常，请稍后再试' }
  }
}

/**
 * 从百度返回结果中提取科属信息
 */
const STOP_CHARS = '是为有的在和与或也又没又名'

function _extractKZ(text, suffix) {
  const re = new RegExp('[\\u4e00-\\u9fa5]{1,6}' + suffix)
  const m = text.match(re)
  if (!m) return ''
  let raw = m[0].replace(suffix, '')
  while (raw.length > 0 && STOP_CHARS.includes(raw[0])) raw = raw.slice(1)
  return raw ? raw + suffix : ''
}

function extractFamily(result) {
  const desc = (result.baike_info && result.baike_info.description) || ''
  const title = (result.baike_info && result.baike_info.title) || ''
  const text = desc + ' ' + title + ' ' + (result.name || '')
  return _extractKZ(text, '\u79d1')
}

function extractGenus(result) {
  const desc = (result.baike_info && result.baike_info.description) || ''
  const title = (result.baike_info && result.baike_info.title) || ''
  const text = desc + ' ' + title + ' ' + (result.name || '')
  const keMatch = text.match(/[\u4e00-\u9fa5]{1,6}\u79d1/)
  const after = keMatch ? text.slice(keMatch.index + keMatch[0].length) : text
  return _extractKZ(after, '\u5c5e')
}
