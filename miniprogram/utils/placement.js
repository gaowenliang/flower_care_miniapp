// utils/placement.js — 植物摆放建议

const plantsData = require('../data/plants')

/**
 * 根据房间光照条件推荐植物
 * @param {string} location 房间位置（阳台/客厅/卧室/书房/窗台/花园）
 * @returns {Array} 推荐植物列表
 */
function recommendByLocation(location) {
  const lightMap = {
    '阳台': ['充足', '直射', '6h'],
    '客厅': ['散射', '明亮', '半阴'],
    '卧室': ['耐阴', '散射', '半阴'],
    '书房': ['散射', '半阴', '耐阴'],
    '窗台': ['明亮', '散射', '直射'],
    '花园': ['充足', '直射', '6h']
  }

  const keywords = lightMap[location] || lightMap['客厅']
  const all = plantsData.plants

  return all.filter(p => {
    const light = p.care.light || ''
    return keywords.some(k => light.includes(k))
  }).map(p => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    category: p.category,
    difficulty: p.care.difficulty,
    reason: `${p.name}适合${location}（${p.care.light}，${p.care.difficulty}）`
  })).slice(0, 6)
}

/**
 * 生成摆放建议文案
 */
function getPlacementTips(location) {
  const tips = {
    '阳台': '阳台光照充足，适合大部分开花植物和蔬果。注意夏季高温遮阳，冬季保温防冻。',
    '客厅': '客厅光线明亮但非直射，适合耐阴到散射光的绿植。远离空调出风口，定期转盆让植物均匀受光。',
    '卧室': '卧室夜间不宜放太多植物（会消耗氧气），选1-2盆耐阴绿植即可。芦荟、虎皮兰夜间也能释放氧气。',
    '书房': '书房适合桌面小盆栽，选耐阴好养的品种。薄荷、罗勒等香草还能提神醒脑。',
    '窗台': '窗台光照好但温差大，多肉和香草类很合适。注意冬季窗户附近温度低，必要时移开。',
    '花园': '户外空间大，蔬果和大型花卉都能种。注意排水、防虫，冬季地栽植物根部覆盖保温。'
  }
  return tips[location] || tips['客厅']
}

module.exports = {
  recommendByLocation,
  getPlacementTips
}
