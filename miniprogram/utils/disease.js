// utils/disease.js — 植物病害诊断

// 常见病害数据库（按症状匹配）
const DISEASES = [
  {
    id: 'yellow_leaf',
    name: '黄叶病',
    symptoms: ['黄叶', '叶片发黄', '叶子变黄', '变黄', '发黄'],
    causes: '浇水过多/过少、光照不足、缺肥',
    solutions: ['检查土壤湿度，调整浇水频率', '移到光照充足的位置', '适当追施氮肥', '剪掉严重黄叶减少养分消耗'],
    severity: 'low',
    emoji: '🟡'
  },
  {
    id: 'root_rot',
    name: '烂根',
    symptoms: ['烂根', '根部发黑', '发臭', '土壤很湿', '一直湿'],
    causes: '浇水过多、排水不良、土壤不透气',
    solutions: ['立即停止浇水', '脱盆检查根系，剪掉烂根', '换透气性好的土壤重新上盆', '浇水前确认土壤干透'],
    severity: 'high',
    emoji: '🔴'
  },
  {
    id: 'leaf_spot',
    name: '叶斑病',
    symptoms: ['斑点', '黑斑', '褐斑', '叶子有斑', '黑点'],
    causes: '真菌感染，多因高温高湿、通风不良',
    solutions: ['摘除病叶并销毁', '增加通风', '避免叶面喷水', '喷洒多菌灵等杀菌剂'],
    severity: 'medium',
    emoji: '🟠'
  },
  {
    id: 'powdery_mildew',
    name: '白粉病',
    symptoms: ['白粉', '白色粉末', '发霉', '白色霉斑'],
    causes: '真菌感染，空气不流通、氮肥过多',
    solutions: ['增加通风和光照', '减少氮肥使用', '喷洒硫磺悬浮剂或小苏打水', '剪掉感染部分'],
    severity: 'medium',
    emoji: '⚪'
  },
  {
    id: 'spider_mite',
    name: '红蜘蛛',
    symptoms: ['红蜘蛛', '蛛网', '叶子有网', '小虫', '虫子'],
    causes: '干燥环境、通风差',
    solutions: ['用水冲洗叶片', '增加环境湿度', '喷洒专用杀螨剂', '隔离感染植物'],
    severity: 'medium',
    emoji: '🕷️'
  },
  {
    id: 'scale_insect',
    name: '介壳虫',
    symptoms: ['介壳虫', '白色小虫', '粘液', '蜜露', '小壳'],
    causes: '通风不良、高温高湿',
    solutions: ['用酒精棉擦除虫体', '喷洒蚧必治等药剂', '严重时剪掉受害枝叶', '加强通风'],
    severity: 'medium',
    emoji: '🐛'
  },
  {
    id: 'overwater',
    name: '浇水过多',
    symptoms: ['叶子蔫', '下垂', '软烂', '积水', '水多'],
    causes: '浇水频率过高、排水不畅',
    solutions: ['暂停浇水，等土壤干透', '检查盆底排水孔是否堵塞', '更换疏松透气的土壤', '后续按"见干见湿"原则浇水'],
    severity: 'low',
    emoji: '💧'
  },
  {
    id: 'underwater',
    name: '缺水',
    symptoms: ['干枯', '萎蔫', '叶片皱', '边缘干', '发脆'],
    causes: '浇水不足、忘记浇水',
    solutions: ['立即浇透水', '之后建立浇水提醒', '严重时整盆浸泡吸水', '剪掉干枯叶片'],
    severity: 'low',
    emoji: '🏜️'
  },
  {
    id: 'sunburn',
    name: '晒伤',
    symptoms: ['晒伤', '灼伤', '焦边', '白斑', '日灼'],
    causes: '阳光直射过强、突然暴晒',
    solutions: ['移到散射光位置', '逐渐增加光照让植物适应', '剪掉严重晒伤的叶片', '夏季中午遮阳'],
    severity: 'low',
    emoji: '☀️'
  },
  {
    id: 'cold_damage',
    name: '冻害',
    symptoms: ['冻伤', '发黑', '水渍状', '冻了', '低温'],
    causes: '温度过低、冷风直吹',
    solutions: ['移到温暖处（不要立刻高温）', '剪掉冻伤部分', '避免冷风直吹', '冬季注意保温'],
    severity: 'high',
    emoji: '❄️'
  }
]

/**
 * 根据症状描述诊断病害
 * @param {string} input 用户输入的症状描述
 * @returns {Array} 匹配的病害列表
 */
function diagnose(input) {
  if (!input || !input.trim()) return []

  const text = input.toLowerCase()
  const results = []

  DISEASES.forEach(disease => {
    let matchCount = 0
    let matchedSymptoms = []
    disease.symptoms.forEach(symptom => {
      if (text.includes(symptom)) {
        matchCount++
        matchedSymptoms.push(symptom)
      }
    })

    if (matchCount > 0) {
      results.push({
        ...disease,
        matchCount,
        matchedSymptoms,
        confidence: Math.min(matchCount / disease.symptoms.length * 100, 100)
      })
    }
  })

  // 按匹配数排序
  results.sort((a, b) => b.matchCount - a.matchCount)

  return results.slice(0, 3) // 最多返回3个可能
}

/**
 * 获取所有病害列表（用于浏览）
 */
function getAllDiseases() {
  return DISEASES
}

module.exports = {
  diagnose,
  getAllDiseases,
  DISEASES
}
