// cloud/functions/familyManage/index.js
// 家庭管理云函数 v3：完整功能
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const POINT_RULES = { water: 2, fertilize: 3, prune: 4, repot: 5, spray: 3, photo: 1, note: 1, retro: 2, custom: 1 }

async function getMemberInfo(openid) {
  const res = await db.collection('family_members').where({ openid }).limit(1).get()
  return res.data.length > 0 ? res.data[0] : null
}

// ========== 动态流工具 ==========
async function logActivity(familyId, openid, type, content) {
  const member = await getMemberInfo(openid)
  const nickname = member ? (member.nickname || '成员') : '成员'
  await db.collection('family_activities').add({
    data: { familyId, openid, nickname, type, content, createdAt: Date.now() }
  })
}

// ========== 里程碑检测 ==========
const MILESTONE_RULES = [
  { id: 'days_7', name: '🌱 一周纪念', desc: '养了7天', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 7 * 86400000 },
  { id: 'days_30', name: '🌿 一个月', desc: '养了30天', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 30 * 86400000 },
  { id: 'days_100', name: '🌳 百日纪念', desc: '养了100天', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 100 * 86400000 },
  { id: 'days_365', name: '🏆 一周年', desc: '养了一整年', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 365 * 86400000 },
  { id: 'care_10', name: '💧 初级养护', desc: '累计养护10次', check: (p) => (p.totalCare || 0) >= 10 },
  { id: 'care_50', name: '💧💧 养护达人', desc: '累计养护50次', check: (p) => (p.totalCare || 0) >= 50 },
  { id: 'care_100', name: '💧💧💧 养护大师', desc: '累计养护100次', check: (p) => (p.totalCare || 0) >= 100 },
]

async function checkMilestones(familyId, plantId) {
  const plantRes = await db.collection('family_plants').doc(plantId).get()
  const plant = plantRes.data
  if (!plant) return []

  // 统计该植物养护次数
  const careRes = await db.collection('family_records').where({ familyId, plantId }).count()
  plant.totalCare = careRes.total

  const newMilestones = []
  for (const rule of MILESTONE_RULES) {
    if (!rule.check(plant)) continue
    // 检查是否已记录
    const existRes = await db.collection('family_milestones').where({ familyId, plantId, milestoneId: rule.id }).limit(1).get()
    if (existRes.data.length > 0) continue

    await db.collection('family_milestones').add({
      data: { familyId, plantId, milestoneId: rule.id, name: rule.name, desc: rule.desc, plantName: plant.nickname || plant.name, createdAt: Date.now() }
    })
    newMilestones.push(rule)
  }
  return newMilestones
}

// ========== 基础家庭操作 ==========

async function createFamily(openid, { name }) {
  if (!name || !name.trim()) return { success: false, error: '请输入家庭名称' }
  name = name.trim().slice(0, 20)
  const existing = await db.collection('family_members').where({ openid }).limit(1).get()
  if (existing.data.length > 0) return { success: false, error: '你已在家庭中，请先退出当前家庭' }

  let inviteCode = ''
  for (let i = 0; i < 10; i++) {
    inviteCode = genInviteCode()
    const dup = await db.collection('families').where({ inviteCode }).limit(1).get()
    if (dup.data.length === 0) break
  }

  const now = Date.now()
  const familyRes = await db.collection('families').add({
    data: { name, inviteCode, createdBy: openid, memberCount: 1, createdAt: now, updatedAt: now }
  })
  await db.collection('family_members').add({
    data: { familyId: familyRes._id, openid, nickname: '', avatar: '', role: 'admin', joinedAt: now, points: 0, totalCare: 0, adoptedPlants: [] }
  })
  return { success: true, familyId: familyRes._id, inviteCode, name }
}

async function joinFamily(openid, { inviteCode }) {
  if (!inviteCode) return { success: false, error: '请输入邀请码' }
  inviteCode = inviteCode.toUpperCase().trim()
  const existing = await db.collection('family_members').where({ openid }).limit(1).get()
  if (existing.data.length > 0) return { success: false, error: '你已在家庭中' }
  const familyRes = await db.collection('families').where({ inviteCode }).limit(1).get()
  if (familyRes.data.length === 0) return { success: false, error: '邀请码无效' }
  const family = familyRes.data[0]
  if (family.memberCount >= 10) return { success: false, error: '家庭成员已满' }
  const now = Date.now()
  await db.collection('family_members').add({
    data: { familyId: family._id, openid, nickname: '', avatar: '', role: 'member', joinedAt: now, points: 0, totalCare: 0, adoptedPlants: [] }
  })
  await db.collection('families').doc(family._id).update({ data: { memberCount: _.inc(1), updatedAt: now } })
  await logActivity(family._id, openid, 'join', '加入了家庭')
  return { success: true, familyId: family._id, name: family.name }
}

async function getFamilyInfo(openid) {
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) return { success: true, inFamily: false }
  const member = memberRes.data[0]
  const familyRes = await db.collection('families').doc(member.familyId).get()
  const family = familyRes.data
  const membersRes = await db.collection('family_members').where({ familyId: family._id }).orderBy('points', 'desc').get()

  return {
    success: true, inFamily: true,
    family: { _id: family._id, name: family.name, inviteCode: family.inviteCode, createdBy: family.createdBy, memberCount: family.memberCount, createdAt: family.createdAt },
    myRole: member.role, myPoints: member.points || 0, myAdoptedPlants: member.adoptedPlants || [],
    members: membersRes.data.map(m => ({
      openid: m.openid, nickname: m.nickname, avatar: m.avatar, role: m.role, joinedAt: m.joinedAt,
      points: m.points || 0, totalCare: m.totalCare || 0, adoptedCount: (m.adoptedPlants || []).length
    }))
  }
}

async function updateProfile(openid, { nickname, avatar }) {
  const d = { updatedAt: Date.now() }
  if (nickname !== undefined) d.nickname = nickname.slice(0, 20)
  if (avatar !== undefined) d.avatar = avatar
  await db.collection('family_members').where({ openid }).update({ data: d })
  return { success: true }
}

async function toggleAdopt(openid, { plantId }) {
  if (!plantId) return { success: false, error: '缺少植物ID' }
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const adoptedPlants = member.adoptedPlants || []
  const idx = adoptedPlants.indexOf(plantId)

  if (idx >= 0) {
    adoptedPlants.splice(idx, 1)
    await db.collection('family_members').doc(member._id).update({ data: { adoptedPlants } })
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    if (plantRes.data) {
      const adopters = (plantRes.data.adopters || []).filter(a => a !== openid)
      await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
    }
    return { success: true, adopted: false }
  } else {
    adoptedPlants.push(plantId)
    await db.collection('family_members').doc(member._id).update({ data: { adoptedPlants } })
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    if (plantRes.data) {
      const adopters = [...(plantRes.data.adopters || []), openid]
      await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
      await logActivity(member.familyId, openid, 'adopt', `认养了「${plantRes.data.nickname || plantRes.data.name}」`)
    }
    return { success: true, adopted: true }
  }
}

async function leaveFamily(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyRes = await db.collection('families').doc(member.familyId).get()
  if (familyRes.data.createdBy === openid) return { success: false, error: '管理员不能退出' }
  if (member.adoptedPlants && member.adoptedPlants.length > 0) {
    for (const plantId of member.adoptedPlants) {
      try {
        const p = await db.collection('family_plants').doc(plantId).get()
        if (p.data) { const adopters = (p.data.adopters || []).filter(a => a !== openid); await db.collection('family_plants').doc(plantId).update({ data: { adopters } }) }
      } catch (e) {}
    }
  }
  await logActivity(member.familyId, openid, 'leave', '离开了家庭')
  await db.collection('family_members').doc(member._id).remove()
  await db.collection('families').doc(member.familyId).update({ data: { memberCount: _.inc(-1) } })
  return { success: true }
}

async function dissolveFamily(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyRes = await db.collection('families').doc(member.familyId).get()
  if (familyRes.data.createdBy !== openid) return { success: false, error: '仅管理员' }
  const familyId = member.familyId
  const batchDelete = async (col) => { while (true) { const r = await db.collection(col).where({ familyId }).limit(100).get(); if (!r.data.length) break; for (const d of r.data) await db.collection(col).doc(d._id).remove(); if (r.data.length < 100) break } }
  await batchDelete('family_members')
  await batchDelete('family_plants')
  await batchDelete('family_records')
  await batchDelete('family_tasks')
  await batchDelete('family_activities')
  await batchDelete('family_milestones')
  await batchDelete('family_wishlists')
  await batchDelete('family_duties')
  await db.collection('families').doc(familyId).remove()
  return { success: true }
}

async function kickMember(openid, { targetOpenid }) {
  if (!targetOpenid) return { success: false, error: '缺少目标' }
  const my = await getMemberInfo(openid)
  if (!my) return { success: false, error: '不在家庭中' }
  const familyRes = await db.collection('families').doc(my.familyId).get()
  if (familyRes.data.createdBy !== openid) return { success: false, error: '仅管理员' }
  const targetRes = await db.collection('family_members').where({ familyId: my.familyId, openid: targetOpenid }).limit(1).get()
  if (!targetRes.data.length) return { success: false, error: '该用户不在家庭中' }
  const target = targetRes.data[0]
  if (target.adoptedPlants && target.adoptedPlants.length > 0) {
    for (const pid of target.adoptedPlants) { try { const p = await db.collection('family_plants').doc(pid).get(); if (p.data) { const a = (p.data.adopters || []).filter(x => x !== targetOpenid); await db.collection('family_plants').doc(pid).update({ data: { adopters: a } }) } } catch (e) {} }
  }
  await db.collection('family_members').doc(target._id).remove()
  await db.collection('families').doc(my.familyId).update({ data: { memberCount: _.inc(-1) } })
  return { success: true }
}

// ========== 动态流 ==========
async function getActivities(openid, { limit }) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const l = Math.min(limit || 30, 100)
  const res = await db.collection('family_activities').where({ familyId: member.familyId }).orderBy('createdAt', 'desc').limit(l).get()
  return { success: true, activities: res.data }
}

// ========== 心愿单 ==========
async function getWishlist(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const res = await db.collection('family_wishlists').where({ familyId: member.familyId }).orderBy('createdAt', 'desc').limit(50).get()
  return { success: true, wishlists: res.data }
}

async function addWishlist(openid, { name, note }) {
  if (!name || !name.trim()) return { success: false, error: '请输入植物名称' }
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  await db.collection('family_wishlists').add({
    data: { familyId: member.familyId, name: name.trim().slice(0, 30), note: (note || '').slice(0, 100), addedBy: openid, nickname: member.nickname || '成员', fulfilled: false, createdAt: Date.now() }
  })
  await logActivity(member.familyId, openid, 'wishlist', `想要养「${name.trim()}」`)
  return { success: true }
}

async function fulfillWishlist(openid, { wishlistId }) {
  if (!wishlistId) return { success: false, error: '缺少ID' }
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const wlRes = await db.collection('family_wishlists').doc(wishlistId).get()
  if (!wlRes.data || wlRes.data.familyId !== member.familyId) return { success: false, error: '心愿不存在' }
  await db.collection('family_wishlists').doc(wishlistId).update({ data: { fulfilled: true, fulfilledBy: openid, fulfilledAt: Date.now() } })
  await logActivity(member.familyId, openid, 'fulfill', `实现了心愿「${wlRes.data.name}」🎉`)
  return { success: true }
}

async function removeWishlist(openid, { wishlistId }) {
  if (!wishlistId) return { success: false, error: '缺少ID' }
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const wlRes = await db.collection('family_wishlists').doc(wishlistId).get()
  if (!wlRes.data || wlRes.data.familyId !== member.familyId) return { success: false, error: '心愿不存在' }
  if (member.role !== 'admin' && wlRes.data.addedBy !== openid) return { success: false, error: '只能删除自己的' }
  await db.collection('family_wishlists').doc(wishlistId).remove()
  return { success: true }
}

// ========== 里程碑 ==========
async function getMilestones(openid, { limit }) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const l = Math.min(limit || 20, 50)
  const res = await db.collection('family_milestones').where({ familyId: member.familyId }).orderBy('createdAt', 'desc').limit(l).get()
  return { success: true, milestones: res.data }
}

// ========== 养护PK（本周/本月排名） ==========
async function getPK(openid, { period }) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyId = member.familyId
  const now = Date.now()
  const since = period === 'month' ? now - 30 * 86400000 : now - 7 * 86400000

  const membersRes = await db.collection('family_members').where({ familyId }).get()
  const memberMap = {}; membersRes.data.forEach(m => { memberMap[m.openid] = m })

  // 获取记录
  const allRecords = []; let offset = 0
  while (true) {
    const batch = await db.collection('family_records').where({ familyId, date: _.gte(since) }).orderBy('date', 'desc').skip(offset).limit(100).get()
    allRecords.push(...batch.data)
    if (batch.data.length < 100) break
    offset += 100; if (offset >= 3000) break
  }

  // 按类型统计每人
  const stats = {}
  allRecords.forEach(r => {
    if (!stats[r.createdBy]) stats[r.createdBy] = { openid: r.createdBy, nickname: (memberMap[r.createdBy] || {}).nickname || '未知', total: 0, byType: {} }
    stats[r.createdBy].total++
    stats[r.createdBy].byType[r.type] = (stats[r.createdBy].byType[r.type] || 0) + 1
  })

  // 徽章
  const badges = []
  const sorted = Object.values(stats).sort((a, b) => b.total - a.total)
  if (sorted[0]) badges.push({ emoji: '👑', title: '养护之王', nickname: sorted[0].nickname, desc: `${sorted[0].total}次` })

  const waterKing = sorted.filter(s => (s.byType.water || 0) > 0).sort((a, b) => (b.byType.water || 0) - (a.byType.water || 0))[0]
  if (waterKing) badges.push({ emoji: '💧', title: '浇水王', nickname: waterKing.nickname, desc: `${waterKing.byType.water}次` })

  const photoKing = sorted.filter(s => (s.byType.photo || 0) > 0).sort((a, b) => (b.byType.photo || 0) - (a.byType.photo || 0))[0]
  if (photoKing) badges.push({ emoji: '📷', title: '摄影师', nickname: photoKing.nickname, desc: `${photoKing.byType.photo}张` })

  return { success: true, badges, ranking: sorted }
}

// ========== 健康看板 ==========
async function getHealthBoard(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const plantsRes = await db.collection('family_plants').where({ familyId: member.familyId }).get()
  const plants = plantsRes.data.map(p => {
    // 简单健康评估
    const days = Math.floor((Date.now() - (p.addedAt || Date.now())) / 86400000)
    let score = 80 // 基础分
    if (days > 30) score += 5
    if (days > 100) score += 5
    if (p.adopters && p.adopters.length > 0) score += 5 // 有人认养加分
    score = Math.min(100, score)
    const level = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor'
    const emoji = score >= 90 ? '😊' : score >= 70 ? '🙂' : score >= 50 ? '😐' : '😟'
    return { _id: p._id, name: p.nickname || p.name, emoji: p.emoji, score, level, emojiIcon: emoji, location: p.location, adopterCount: (p.adopters || []).length }
  })
  plants.sort((a, b) => a.score - b.score) // 需要照顾的排前面
  return { success: true, plants }
}

// ========== 报表（保留原有） ==========
async function getReport(openid, { period }) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyId = member.familyId
  const now = Date.now()
  let since = period === 'week' ? now - 7 * 86400000 : period === 'month' ? now - 30 * 86400000 : now - 365 * 86400000

  const allRecords = []; let offset = 0
  while (true) {
    const batch = await db.collection('family_records').where({ familyId, date: _.gte(since) }).orderBy('date', 'desc').skip(offset).limit(100).get()
    allRecords.push(...batch.data); if (batch.data.length < 100) break; offset += 100; if (offset >= 5000) break
  }
  const records = allRecords

  const membersRes = await db.collection('family_members').where({ familyId }).get()
  const memberMap = {}; membersRes.data.forEach(m => { memberMap[m.openid] = m })

  const memberStats = {}
  records.forEach(r => {
    if (!memberStats[r.createdBy]) memberStats[r.createdBy] = { openid: r.createdBy, nickname: (memberMap[r.createdBy] || {}).nickname || '未知', total: 0, byType: {}, plants: {} }
    memberStats[r.createdBy].total++; memberStats[r.createdBy].byType[r.type] = (memberStats[r.createdBy].byType[r.type] || 0) + 1; memberStats[r.createdBy].plants[r.plantId] = (memberStats[r.createdBy].plants[r.plantId] || 0) + 1
  })

  const typeStats = {}; records.forEach(r => { typeStats[r.typeName || r.type] = (typeStats[r.typeName || r.type] || 0) + 1 })

  return {
    success: true, period, totalRecords: records.length, typeStats,
    memberStats: Object.values(memberStats).sort((a, b) => b.total - a.total).map(s => ({ ...s, nickname: (memberMap[s.openid] || {}).nickname || '未知' }))
  }
}

// ========== 周报生成 ==========
async function generateWeeklyReport(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyId = member.familyId
  const now = Date.now()
  const since = now - 7 * 86400000

  const recordsRes = await db.collection('family_records').where({ familyId, date: _.gte(since) }).limit(1000).get()
  const plantsRes = await db.collection('family_plants').where({ familyId }).limit(100).get()
  const membersRes = await db.collection('family_members').where({ familyId }).get()
  const memberMap = {}; membersRes.data.forEach(m => { memberMap[m.openid] = m })

  const totalCare = recordsRes.data.length
  const memberTotals = {}
  recordsRes.data.forEach(r => { memberTotals[r.createdBy] = (memberTotals[r.createdBy] || 0) + 1 })
  const topMember = Object.entries(memberTotals).sort((a, b) => b[1] - a[1])[0]
  const topMemberName = topMember ? (memberMap[topMember[0]] || {}).nickname || '未知' : '暂无'

  // 找无人照顾的植物
  const caredPlantIds = new Set(recordsRes.data.map(r => r.plantId))
  const neglectedPlants = plantsRes.data.filter(p => !caredPlantIds.has(p._id)).map(p => p.nickname || p.name)

  return {
    success: true,
    report: {
      totalCare,
      topMember: topMemberName,
      topCount: topMember ? topMember[1] : 0,
      totalPlants: plantsRes.data.length,
      neglectedPlants: neglectedPlants.slice(0, 5),
      week: `${new Date(since).getMonth() + 1}/${new Date(since).getDate()} - ${new Date(now).getMonth() + 1}/${new Date(now).getDate()}`
    }
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data } = event
  try {
    switch (action) {
      case 'create': return await createFamily(OPENID, data || {})
      case 'join': return await joinFamily(OPENID, data || {})
      case 'info': return await getFamilyInfo(OPENID)
      case 'updateProfile': return await updateProfile(OPENID, data || {})
      case 'toggleAdopt': return await toggleAdopt(OPENID, data || {})
      case 'addPoints': return { success: true }
      case 'leave': return await leaveFamily(OPENID)
      case 'dissolve': return await dissolveFamily(OPENID)
      case 'kick': return await kickMember(OPENID, data || {})
      case 'report': return await getReport(OPENID, data || {})
      // 新增
      case 'activities': return await getActivities(OPENID, data || {})
      case 'wishlist': return await getWishlist(OPENID)
      case 'addWishlist': return await addWishlist(OPENID, data || {})
      case 'fulfillWishlist': return await fulfillWishlist(OPENID, data || {})
      case 'removeWishlist': return await removeWishlist(OPENID, data || {})
      case 'milestones': return await getMilestones(OPENID, data || {})
      case 'pk': return await getPK(OPENID, data || {})
      case 'healthBoard': return await getHealthBoard(OPENID)
      case 'weeklyReport': return await generateWeeklyReport(OPENID)
      default: return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('familyManage error:', err)
    return { success: false, error: err.message }
  }
}
