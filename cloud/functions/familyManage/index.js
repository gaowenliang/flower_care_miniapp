// cloud/functions/familyManage/index.js
// 家庭管理云函数：创建/加入/退出/解散家庭，成员管理，成就积分，认养
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

// 积分规则
const POINT_RULES = {
  water: 2,
  fertilize: 3,
  prune: 4,
  repot: 5,
  spray: 3,
  photo: 1,
  note: 1,
  retro: 2
}

async function getMemberInfo(openid) {
  const res = await db.collection('family_members').where({ openid }).limit(1).get()
  if (res.data.length === 0) return null
  return res.data[0]
}

/**
 * 创建家庭
 */
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
  const familyId = familyRes._id

  await db.collection('family_members').add({
    data: { familyId, openid, nickname: '', avatar: '', role: 'admin', joinedAt: now, points: 0, totalCare: 0, adoptedPlants: [] }
  })

  return { success: true, familyId, inviteCode, name }
}

/**
 * 加入家庭
 */
async function joinFamily(openid, { inviteCode }) {
  if (!inviteCode) return { success: false, error: '请输入邀请码' }
  inviteCode = inviteCode.toUpperCase().trim()

  const existing = await db.collection('family_members').where({ openid }).limit(1).get()
  if (existing.data.length > 0) return { success: false, error: '你已在家庭中，请先退出当前家庭' }

  const familyRes = await db.collection('families').where({ inviteCode }).limit(1).get()
  if (familyRes.data.length === 0) return { success: false, error: '邀请码无效，请检查后重试' }
  const family = familyRes.data[0]

  if (family.memberCount >= 10) return { success: false, error: '家庭成员已满（最多10人）' }

  const now = Date.now()
  await db.collection('family_members').add({
    data: { familyId: family._id, openid, nickname: '', avatar: '', role: 'member', joinedAt: now, points: 0, totalCare: 0, adoptedPlants: [] }
  })

  await db.collection('families').doc(family._id).update({
    data: { memberCount: _.inc(1), updatedAt: now }
  })

  return { success: true, familyId: family._id, name: family.name }
}

/**
 * 获取家庭信息（含成员积分和认养信息）
 */
async function getFamilyInfo(openid) {
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) return { success: true, inFamily: false }

  const member = memberRes.data[0]
  const familyRes = await db.collection('families').doc(member.familyId).get()
  const family = familyRes.data

  const membersRes = await db.collection('family_members').where({ familyId: family._id }).orderBy('points', 'desc').get()
  const members = membersRes.data

  return {
    success: true,
    inFamily: true,
    family: { _id: family._id, name: family.name, inviteCode: family.inviteCode, createdBy: family.createdBy, memberCount: family.memberCount, createdAt: family.createdAt },
    myRole: member.role,
    myPoints: member.points || 0,
    myAdoptedPlants: member.adoptedPlants || [],
    members: members.map(m => ({
      openid: m.openid, nickname: m.nickname, avatar: m.avatar, role: m.role, joinedAt: m.joinedAt,
      points: m.points || 0, totalCare: m.totalCare || 0, adoptedCount: (m.adoptedPlants || []).length
    }))
  }
}

/**
 * 更新成员昵称/头像
 */
async function updateProfile(openid, { nickname, avatar }) {
  const updateData = { updatedAt: Date.now() }
  if (nickname !== undefined) updateData.nickname = nickname.slice(0, 20)
  if (avatar !== undefined) updateData.avatar = avatar
  await db.collection('family_members').where({ openid }).update({ data: updateData })
  return { success: true }
}

/**
 * 认养植物 / 取消认养
 */
async function toggleAdopt(openid, { plantId }) {
  if (!plantId) return { success: false, error: '缺少植物ID' }

  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }

  const adoptedPlants = member.adoptedPlants || []
  const idx = adoptedPlants.indexOf(plantId)

  if (idx >= 0) {
    // 取消认养
    adoptedPlants.splice(idx, 1)
    await db.collection('family_members').doc(member._id).update({ data: { adoptedPlants } })
    // 同时更新植物的 adoptedBy
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    if (plantRes.data) {
      const adopters = (plantRes.data.adopters || []).filter(a => a !== openid)
      await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
    }
    return { success: true, adopted: false }
  } else {
    // 认养
    adoptedPlants.push(plantId)
    await db.collection('family_members').doc(member._id).update({ data: { adoptedPlants } })
    // 同时更新植物
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    if (plantRes.data) {
      const adopters = [...(plantRes.data.adopters || []), openid]
      await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
    }
    return { success: true, adopted: true }
  }
}

/**
 * 给成员加分（由 familyData 调用，不是前端直接调）
 */
async function addPoints(openid, { type, count }) {
  const points = (POINT_RULES[type] || 1) * (count || 1)
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }

  await db.collection('family_members').doc(member._id).update({
    data: { points: _.inc(points), totalCare: _.inc(count || 1) }
  })
  return { success: true, points }
}

/**
 * 退出家庭
 */
async function leaveFamily(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '你不在任何家庭中' }

  const familyRes = await db.collection('families').doc(member.familyId).get()
  if (familyRes.data.createdBy === openid) return { success: false, error: '管理员不能退出家庭，请先解散家庭' }

  // 清理认养关系
  if (member.adoptedPlants && member.adoptedPlants.length > 0) {
    for (const plantId of member.adoptedPlants) {
      try {
        const plantRes = await db.collection('family_plants').doc(plantId).get()
        if (plantRes.data) {
          const adopters = (plantRes.data.adopters || []).filter(a => a !== openid)
          await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
        }
      } catch (e) {}
    }
  }

  await db.collection('family_members').doc(member._id).remove()
  await db.collection('families').doc(member.familyId).update({
    data: { memberCount: _.inc(-1), updatedAt: Date.now() }
  })
  return { success: true }
}

/**
 * 解散家庭
 */
async function dissolveFamily(openid) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '你不在任何家庭中' }

  const familyRes = await db.collection('families').doc(member.familyId).get()
  if (familyRes.data.createdBy !== openid) return { success: false, error: '只有管理员可以解散家庭' }

  const familyId = member.familyId

  const batchDelete = async (collection) => {
    let deleted = 0
    while (true) {
      const res = await db.collection(collection).where({ familyId }).limit(100).get()
      if (res.data.length === 0) break
      for (const doc of res.data) await db.collection(collection).doc(doc._id).remove()
      deleted += res.data.length
      if (res.data.length < 100) break
    }
    return deleted
  }

  await batchDelete('family_members')
  await batchDelete('family_plants')
  await batchDelete('family_records')
  await batchDelete('family_tasks')
  await db.collection('families').doc(familyId).remove()

  return { success: true }
}

/**
 * 踢出成员
 */
async function kickMember(openid, { targetOpenid }) {
  if (!targetOpenid) return { success: false, error: '缺少目标用户' }

  const myMember = await getMemberInfo(openid)
  if (!myMember) return { success: false, error: '你不在任何家庭中' }

  const familyRes = await db.collection('families').doc(myMember.familyId).get()
  if (familyRes.data.createdBy !== openid) return { success: false, error: '只有管理员可以移除成员' }

  const targetRes = await db.collection('family_members').where({ familyId: myMember.familyId, openid: targetOpenid }).limit(1).get()
  if (targetRes.data.length === 0) return { success: false, error: '该用户不在此家庭中' }

  const target = targetRes.data[0]

  // 清理认养关系
  if (target.adoptedPlants && target.adoptedPlants.length > 0) {
    for (const plantId of target.adoptedPlants) {
      try {
        const plantRes = await db.collection('family_plants').doc(plantId).get()
        if (plantRes.data) {
          const adopters = (plantRes.data.adopters || []).filter(a => a !== targetOpenid)
          await db.collection('family_plants').doc(plantId).update({ data: { adopters } })
        }
      } catch (e) {}
    }
  }

  await db.collection('family_members').doc(target._id).remove()
  await db.collection('families').doc(myMember.familyId).update({
    data: { memberCount: _.inc(-1), updatedAt: Date.now() }
  })
  return { success: true }
}

/**
 * 获取家庭报表：每位成员的打理统计
 */
async function getReport(openid, { period }) {
  const member = await getMemberInfo(openid)
  if (!member) return { success: false, error: '不在家庭中' }
  const familyId = member.familyId

  // 计算时间范围
  const now = Date.now()
  let since = 0
  if (period === 'week') since = now - 7 * 86400000
  else if (period === 'month') since = now - 30 * 86400000
  else since = now - 365 * 86400000

  // 获取时间段内的记录
  const recordsRes = await db.collection('family_records').where({
    familyId,
    date: _.gte(since)
  }).limit(1000).get()

  const records = recordsRes.data

  // 获取成员信息
  const membersRes = await db.collection('family_members').where({ familyId }).get()
  const memberMap = {}
  membersRes.data.forEach(m => { memberMap[m.openid] = m })

  // 按成员统计
  const memberStats = {}
  records.forEach(r => {
    const oid = r.createdBy
    if (!memberStats[oid]) {
      memberStats[oid] = { openid: oid, nickname: (memberMap[oid] || {}).nickname || '未知', total: 0, byType: {}, plants: {} }
    }
    const stat = memberStats[oid]
    stat.total++
    stat.byType[r.type] = (stat.byType[r.type] || 0) + 1
    stat.plants[r.plantId] = (stat.plants[r.plantId] || 0) + 1
  })

  // 按日期统计（最近7天或30天）
  const dailyStats = {}
  records.forEach(r => {
    const d = new Date(r.date)
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
    if (!dailyStats[dateStr]) dailyStats[dateStr] = {}
    const oid = r.createdBy
    dailyStats[dateStr][oid] = (dailyStats[dateStr][oid] || 0) + 1
  })

  // 总体类型统计
  const typeStats = {}
  records.forEach(r => {
    typeStats[r.typeName || r.type] = (typeStats[r.typeName || r.type] || 0) + 1
  })

  const reportMembers = Object.values(memberStats).sort((a, b) => b.total - a.total)
  const dates = Object.keys(dailyStats).sort()

  return {
    success: true,
    period,
    totalRecords: records.length,
    typeStats,
    memberStats: reportMembers.map(s => ({
      ...s,
      nickname: (memberMap[s.openid] || {}).nickname || '未知'
    })),
    dailyStats,
    dates
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
      case 'addPoints': return await addPoints(OPENID, data || {})
      case 'leave': return await leaveFamily(OPENID)
      case 'dissolve': return await dissolveFamily(OPENID)
      case 'kick': return await kickMember(OPENID, data || {})
      case 'report': return await getReport(OPENID, data || {})
      default: return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('familyManage error:', err)
    return { success: false, error: err.message }
  }
}
