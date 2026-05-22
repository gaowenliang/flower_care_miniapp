// pages/family/family.js - 家庭管理页面
const familyManager = require('../../utils/family/manager')

Page({
  data: {
    loading: true,
    inFamily: false,
    family: null,
    member: null,
    members: [],
    isAdmin: false,
    // 创建家庭
    showCreateModal: false,
    newFamilyName: '',
    // 加入家庭
    showJoinModal: false,
    inviteCode: '',
    // 更新名称
    showRenameModal: false,
    renameValue: ''
  },

  onLoad() {
    this.loadFamilyInfo()
  },

  onShow() {
    this.loadFamilyInfo()
  },

  async loadFamilyInfo() {
    this.setData({ loading: true })

    // 先用缓存
    const cached = familyManager.getFamilyInfo()
    if (cached.inFamily) {
      this.setData({
        inFamily: true,
        family: cached.family,
        member: cached.member,
        isAdmin: cached.member && cached.member.role === 'admin'
      })
    }

    // 从云端刷新
    const result = await familyManager.refreshFamilyStatus()
    if (result.success) {
      this.setData({
        inFamily: result.inFamily,
        family: result.family || null,
        member: result.member || null,
        isAdmin: result.member && result.member.role === 'admin',
        loading: false
      })
      if (result.inFamily) {
        this.loadMembers()
      }
    } else {
      this.setData({ loading: false })
    }
  },

  async loadMembers() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: { action: 'getMembers' }
      })
      if (res.result.success) {
        this.setData({ members: res.result.members })
      }
    } catch (e) {}
  },

  // ========== 创建家庭 ==========

  openCreateModal() {
    this.setData({ showCreateModal: true, newFamilyName: '' })
  },

  onCreateNameInput(e) {
    this.setData({ newFamilyName: e.detail.value })
  },

  async confirmCreate() {
    const name = this.data.newFamilyName.trim()
    if (!name) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '创建中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: {
          action: 'create',
          name,
          nickname: '管理员'
        }
      })
      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: '创建成功 🎉', icon: 'none' })
        this.setData({ showCreateModal: false })
        this.loadFamilyInfo()
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  closeCreateModal() {
    this.setData({ showCreateModal: false })
  },

  // ========== 加入家庭 ==========

  openJoinModal() {
    this.setData({ showJoinModal: true, inviteCode: '' })
  },

  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() })
  },

  async confirmJoin() {
    const code = this.data.inviteCode.trim()
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }

    wx.showLoading({ title: '加入中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: {
          action: 'join',
          inviteCode: code,
          nickname: '成员'
        }
      })
      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({ title: '加入成功 🎉', icon: 'none' })
        this.setData({ showJoinModal: false })
        this.loadFamilyInfo()
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加入失败', icon: 'none' })
    }
  },

  closeJoinModal() {
    this.setData({ showJoinModal: false })
  },

  // ========== 邀请码操作 ==========

  copyInviteCode() {
    if (!this.data.family) return
    wx.setClipboardData({
      data: this.data.family.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' })
    })
  },

  async refreshCode() {
    wx.showLoading({ title: '刷新中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: { action: 'refreshCode' }
      })
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '已刷新', icon: 'none' })
        this.setData({ 'family.inviteCode': res.result.inviteCode })
        familyManager.saveFamilyInfo({
          inFamily: true,
          family: { ...this.data.family, inviteCode: res.result.inviteCode },
          member: this.data.member
        })
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
    }
  },

  // ========== 成员管理 ==========

  kickMember(e) {
    const { openid, nickname } = e.currentTarget.dataset
    wx.showModal({
      title: '移除成员',
      content: `确定将「${nickname}」移出家庭？`,
      confirmColor: '#2E7D32',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            const result = await wx.cloud.callFunction({
              name: 'familyManage',
              data: { action: 'kick', targetOpenId: openid }
            })
            wx.hideLoading()
            if (result.result.success) {
              wx.showToast({ title: '已移除', icon: 'none' })
              this.loadMembers()
            } else {
              wx.showToast({ title: result.result.error, icon: 'none' })
            }
          } catch (e) {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // ========== 退出家庭 ==========

  leaveFamily() {
    wx.showModal({
      title: '退出家庭',
      content: '确定退出当前家庭？退出后将无法查看家庭内的植物。',
      confirmColor: '#2E7D32',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            const result = await wx.cloud.callFunction({
              name: 'familyManage',
              data: { action: 'leave' }
            })
            wx.hideLoading()
            if (result.result.success) {
              familyManager.clearCache()
              wx.showToast({ title: '已退出', icon: 'none' })
              this.loadFamilyInfo()
            } else {
              wx.showToast({ title: result.result.error, icon: 'none' })
            }
          } catch (e) {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // ========== 解散家庭 ==========

  dissolveFamily() {
    wx.showModal({
      title: '⚠️ 解散家庭',
      content: '解散后将删除所有家庭数据（植物、记录、任务），所有成员将被移出。此操作不可恢复！',
      confirmColor: '#D32F2F',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '解散中...' })
          try {
            const result = await wx.cloud.callFunction({
              name: 'familyManage',
              data: { action: 'dissolve' }
            })
            wx.hideLoading()
            if (result.result.success) {
              familyManager.clearCache()
              wx.showToast({ title: '已解散', icon: 'none' })
              this.loadFamilyInfo()
            } else {
              wx.showToast({ title: result.result.error, icon: 'none' })
            }
          } catch (e) {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // ========== 修改家庭名称 ==========

  openRenameModal() {
    this.setData({ showRenameModal: true, renameValue: this.data.family ? this.data.family.name : '' })
  },

  onRenameInput(e) {
    this.setData({ renameValue: e.detail.value })
  },

  async confirmRename() {
    const name = this.data.renameValue.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '修改中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: { action: 'updateName', name }
      })
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '已修改', icon: 'none' })
        this.setData({ showRenameModal: false, 'family.name': name })
        familyManager.saveFamilyInfo({
          inFamily: true,
          family: { ...this.data.family, name },
          member: this.data.member
        })
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
    }
  },

  closeRenameModal() {
    this.setData({ showRenameModal: false })
  },

  preventBubble() {}
})
