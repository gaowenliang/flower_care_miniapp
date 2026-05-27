// cloud/functions/diagnosePlant/index.js
const cloud = require('wx-server-sdk')
const https = require('https')
const querystring = require('querystring')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BAIDU_API_KEY = process.env.BAIDU_API_KEY
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY

let _tokenCache = { token: null, expiresAt: 0 }

function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { req.destroy(); reject(new Error('请求超时')) }, timeoutMs)
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

function httpPost(hostname, path, body, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { req.destroy(); reject(new Error('请求超时')) }, timeoutMs)
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
    req.write(body)
    req.end()
  })
}

async function getBaiduToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) return _tokenCache.token
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
  const json = await httpGet(url, 8000)
  if (!json.access_token) throw new Error('百度 Token 获取失败: ' + (json.error_description || JSON.stringify(json).slice(0, 200)))
  _tokenCache = { token: json.access_token, expiresAt: Date.now() + 29 * 86400000 }
  return json.access_token
}

function detectDisease(name, description) {
  const diseaseKeywords = {
    '黄': { name: '黄叶病', causes: '浇水过多、缺肥、光照不足或根系受损', solutions: ['检查排水是否通畅，避免积水', '适当补充氮肥', '移至光照充足处', '检查根系是否腐烂'] },
    '黑斑': { name: '黑斑病', causes: '真菌感染，多因高温高湿、通风不良', solutions: ['剪除病叶并销毁', '喷洒多菌灵或百菌清', '改善通风条件', '避免叶片长时间积水'] },
    '白粉': { name: '白粉病', causes: '真菌感染，通风差、氮肥过多', solutions: ['喷洒三唑酮或硫磺悬浮剂', '增加通风和光照', '减少氮肥用量', '剪除严重病叶'] },
    '枯萎': { name: '枯萎病', causes: '真菌或细菌感染，土壤过湿', solutions: ['拔除严重病株', '换土消毒', '控制浇水频率', '用恶霉灵灌根'] },
    '腐烂': { name: '根腐病', causes: '浇水过多导致根系缺氧腐烂', solutions: ['脱盆修根，剪掉烂根', '用多菌灵浸泡消毒', '换新土重新栽种', '控水加强通风'] },
    '锈': { name: '锈病', causes: '真菌感染，多发生在春秋季', solutions: ['喷洒粉锈宁', '清除病叶', '避免密植', '增施磷钾肥'] },
    '蚜': { name: '蚜虫', causes: '蚜虫危害，吸食汁液导致叶片卷曲', solutions: ['用棉签蘸酒精擦除', '喷洒吡虫啉', '挂黄色粘虫板', '引入瓢虫等天敌'] },
    '介壳': { name: '介壳虫', causes: '介壳虫寄生，吸食植物汁液', solutions: ['用酒精棉球擦除', '喷洒蚧必治', '修剪严重枝叶', '加强通风'] },
    '红蜘蛛': { name: '红蜘蛛', causes: '螨类害虫，干燥环境易发', solutions: ['增加空气湿度', '喷洒阿维菌素', '用水冲洗叶片', '清除落叶'] },
    '斑点': { name: '叶斑病', causes: '真菌感染，高温多湿环境易发', solutions: ['摘除病叶', '喷洒代森锰锌', '避免叶面浇水', '保持通风'] },
    '霉': { name: '灰霉病', causes: '真菌感染，低温高湿环境', solutions: ['清除病部', '喷洒腐霉利', '降低湿度', '增加通风'] }
  }
  const text = (name + ' ' + (description || '')).toLowerCase()
  const found = []
  for (const [keyword, info] of Object.entries(diseaseKeywords)) {
    if (text.includes(keyword)) found.push({ ...info, severity: 'medium' })
  }
  if (found.length === 0 && description) {
    found.push({
      name: '疑似病害', causes: '需要更清晰的照片或症状描述来精确诊断',
      solutions: ['隔离病株避免传染', '改善通风和光照', '控制浇水避免过湿', '观察几天看是否恶化，必要时咨询园艺师'],
      severity: 'low'
    })
  }
  return found
}

exports.main = async (event) => {
  const { imageData } = event
  if (!imageData) return { success: false, error: '缺少图片数据' }
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) return { success: false, error: 'API未配置，请设置环境变量 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' }

  try {
    const token = await getBaiduToken()
    const postData = querystring.stringify({ image: imageData, baike_num: 3 })
    const result = await httpPost('aip.baidubce.com', `/rest/2.0/image-classify/v1/plant_disease?access_token=${token}`, postData)

    if (result.error_code) {
      return { success: false, error: '识别失败: ' + (result.error_msg || result.error_code) }
    }

    if (result.result && result.result.length > 0) {
      const diseases = []
      for (const r of result.result) {
        const desc = (r.baike_info && r.baike_info.description) || ''
        const name = r.name || ''
        for (const d of detectDisease(name, desc)) {
          diseases.push({ ...d, name: d.name || name, score: r.score ? (r.score * 100).toFixed(1) : 0 })
        }
      }
      const unique = []
      const seen = new Set()
      for (const d of diseases) {
        if (!seen.has(d.name)) { seen.add(d.name); unique.push(d) }
      }
      if (unique.length > 0) return { success: true, diseases: unique.slice(0, 3) }
    }
    return { success: false, error: '未识别到病害，可以试试文字描述症状' }
  } catch (err) {
    console.error('病虫害诊断失败:', err)
    return { success: false, error: err.message || '诊断服务异常' }
  }
}
