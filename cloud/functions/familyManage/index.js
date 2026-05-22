// cloud/functions/familyManage/index.js
// 家庭管理云函数：创建/加入/退出/解散家庭，成员管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉容易混淆的 0O1I
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/**
 * 创建家庭
 */
async function createFamily(openid, { name }) {
  if (!name || !name.trim()) return { success: false, error: '请输入家庭名称' }
  name = name.trim().slice(0, 20)

  // 检查是否已在家庭中
  const existing = await db.collection('family_members').where({ openid }).limit(1).get()
  if (existing.data.length > 0) {
    return { success: false, error: '你已在家庭中，请先退出当前家庭' }
  }

  // 生成唯一邀请码
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
    data: { familyId, openid, nickname: '', avatar: '', role: 'admin', joinedAt: now }
  })

  return { success: true, familyId, inviteCode, name }
}

/**
 * 加入家庭
 */
async function joinFamily(openid, { inviteCode }) {
  if (!inviteCode) return { success: false, error: '请输入邀请码' }
  inviteCode = inviteCode.toUpperCase().trim()

  // 检查是否已在家庭
  const existing = await db.collection('family_members').where({ openid }).limit(1).get()
  if (existing.data.length > 0) {
    return { success: false, error: '你已在家庭中，请先退出当前家庭' }
  }

  // 查找家庭
  const familyRes = await db.collection('families').where({ inviteCode }).limit(1).get()
  if (familyRes.data.length === 0) {
    return { success: false, error: '邀请码无效，请检查后重试' }
  }
  const family = familyRes.data[0]

  // 限制成员数量
  if (family.memberCount >= 10) {
    return { success: false, error: '家庭成员已满（最多10人）' }
  }

  const now = Date.now()
  await db.collection('family_members').add({
    data: { familyId: family._id, openid, nickname: '', avatar: '', role: 'member', joinedAt: now }
  })

  // 更新成员计数
  await db.collection('families').doc(family._id).update({
    data: { memberCount: _.inc(1), updatedAt: now }
  })

  return { success: true, familyId: family._id, name: family.name }
}

/**
 * 获取家庭信息
 */
async function getFamilyInfo(openid) {
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) {
    return { success: true, inFamily: false }
  }
  const member = memberRes.data[0]
  const familyRes = await db.collection('families').doc(member.familyId).get()
  const family = familyRes.data

  // 获取所有成员
  const membersRes = await db.collection('family_members').where({ familyId: family._id }).get()
  const members = membersRes.data

  return {
    success: true,
    inFamily: true,
    family: { _id: family._id, name: family.name, inviteCode: family.inviteCode, createdBy: family.createdBy, memberCount: family.memberCount, createdAt: family.createdAt },
    myRole: member.role,
    members: members.map(m => ({ openid: m.openid, nickname: m.nickname, avatar: m.avatar, role: m.role, joinedAt: m.joinedAt }))
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
 * 退出家庭
 */
async function leaveFamily(openid) {
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) {
    return { success: false, error: '你不在任何家庭中' }
  }
  const member = memberRes.data[0]
  const familyRes = await db.collection('families').doc(member.familyId).get()
  const family = familyRes.data

  // 管理员不能直接退出，需要先转让或解散
  if (family.createdBy === openid) {
    return { success: false, error: '管理员不能退出家庭，请先解散家庭或转让管理员' }
  }

  await db.collection('family_members').doc(member._id).remove()
  await db.collection('families').doc(family._id).update({
    data: { memberCount: _.inc(-1), updatedAt: Date.now() }
  })

  return { success: true }
}

/**
 * 解散家庭（仅管理员）
 */
async function dissolveFamily(openid) {
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) {
    return { success: false, error: '你不在任何家庭中' }
  }
  const member = memberRes.data[0]
  const familyRes = await db.collection('families').doc(member.familyId).get()
  const family = familyRes.data

  if (family.createdBy !== openid) {
    return { success: false, error: '只有管理员可以解散家庭' }
  }

  const familyId = family._id

  // 删除所有成员
  const allMembers = await db.collection('family_members').where({ familyId }).get()
  for (const m of allMembers.data) {
    await db.collection('family_members').doc(m._id).remove()
  }

  // 删除家庭植物、记录、任务
  const batchDelete = async (collection) => {
    const res = await db.collection(collection).where({ familyId }).limit(100).get()
    for (const doc of res.data) {
      await db.collection(collection).doc(doc._id).remove()
    }
  }
  await batchDelete('family_plants')
  await batchDelete('family_records')
  await batchDelete('family_tasks')

  // 删除家庭
  await db.collection('families').doc(familyId).remove()

  return { success: true }
}

/**
 * 踢出成员（仅管理员）
 */
async function kickMember(openid, { targetOpenid }) {
  if (!targetOpenid) return { success: false, error: '缺少目标用户' }

  const myMemberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (myMemberRes.data.length === 0) return { success: false, error: '你不在任何家庭中' }

  const myMember = myMemberRes.data[0]
  const familyRes = await db.collection('families').doc(myMember.familyId).get()
  if (familyRes.data.createdBy !== openid) {
    return { success: false, error: '只有管理员可以移除成员' }
  }

  const targetRes = await db.collection('family_members').where({ familyId: myMember.familyId, openid: targetOpenid }).limit(1).get()
  if (targetRes.data.length === 0) return { success: false, error: '该用户不在此家庭中' }

  await db.collection('family_members').doc(targetRes.data[0]._id).remove()
  await db.collection('families').doc(myMember.familyId).update({
    data: { memberCount: _.inc(-1), updatedAt: Date.now() }
  })

  return { success: true }
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
      case 'leave': return await leaveFamily(OPENID)
      case 'dissolve': return await dissolveFamily(OPENID)
      case 'kick': return await kickMember(OPENID, data || {})
      default: return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('familyManage error:', err)
    return { success: false, error: err.message }
  }
}
