// pages/family/family.js — 家庭管理页面 v2（积分排行+认养+报表）
const family = require('../../utils/family')

Page({
  data: {
    loading: true,
    inFamily: false,
    familyInfo: null,
    myRole: '',
    members: [],
    // 积分排行
    leaderboard: [],
    myPoints: 0,
    // 报表
    activeTab: 'members', // members | report
    reportPeriod: 'week',
    reportData: null,
    reportLoading: false,
    // 创建家庭
    showCreate: false,
    familyName: '',
    // 加入家庭
    showJoin: false,
    inviteCode: '',
    // 颜色
    colorMap: ['#4CAF50', '#FF9800', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722', '#795548']
  },

  async onLoad() {
    await this.loadFamilyInfo()
    setTimeout(() => this.setData({ loading: false }), 200)
  },

  async onShow() {
    if (!this.data.loading) await this.loadFamilyInfo()
  },

  async loadFamilyInfo() {
    const result = await family.refreshFamilyInfo()
    if (result.success && result.inFamily) {
      const members = (result.members || []).map((m, idx) => ({
        ...m,
        initial: (m.nickname || '用').charAt(0),
        color: this.data.colorMap[idx % this.data.colorMap.length]
      }))

      this.setData({
        inFamily: true,
        familyInfo: result.family,
        myRole: result.myRole,
        myPoints: result.myPoints || 0,
        members,
        leaderboard: members.sort((a, b) => (b.points || 0) - (a.points || 0))
      })
    } else {
      this.setData({ inFamily: false, familyInfo: null, myRole: '', members: [], leaderboard: [] })
    }
  },

  // ========== Tab 切换 ==========

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'report' && !this.data.reportData) {
      this.loadReport()
    }
  },

  // ========== 报表 ==========

  switchPeriod(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ reportPeriod: period })
    this.loadReport()
  },

  async loadReport() {
    this.setData({ reportLoading: true })
    const result = await family.getReport(this.data.reportPeriod)
    if (result.success) {
      // 按成员绘制柱状图数据
      const maxTotal = Math.max(1, ...result.memberStats.map(m => m.total))
      const memberStats = result.memberStats.map(m => ({
        ...m,
        barHeight: Math.max(8, (m.total / maxTotal) * 200),
        percentage: Math.round(m.total / Math.max(1, result.totalRecords) * 100)
      }))

      // 类型统计
      const typeEmoji = { '浇水': '💧', '施肥': '🧪', '修剪': '✂️', '换盆': '🏺', '喷药': '💉', '拍照记录': '📷', '备注': '📝' }
      const typeStats = Object.entries(result.typeStats || {}).map(([name, count]) => ({
        name, count, emoji: typeEmoji[name] || '📋'
      })).sort((a, b) => b.count - a.count)

      this.setData({
        reportData: {
          totalRecords: result.totalRecords,
          memberStats,
          typeStats,
          period: result.period
        },
        reportLoading: false
      })
    } else {
      this.setData({ reportLoading: false })
      wx.showToast({ title: '加载报表失败', icon: 'none' })
    }
  },

  // ========== 创建/加入家庭 ==========

  showCreateModal() { this.setData({ showCreate: true, familyName: '' }) },
  hideCreateModal() { this.setData({ showCreate: false }) },
  onFamilyNameInput(e) { this.setData({ familyName: e.detail.value }) },

  async confirmCreate() {
    const name = this.data.familyName.trim()
    if (!name) { wx.showToast({ title: '请输入家庭名称', icon: 'none' }); return }

    wx.showLoading({ title: '创建中...' })
    const result = await family.manage('create', { name })
    wx.hideLoading()

    if (result.success) {
      wx.showToast({ title: '创建成功! 🏠', icon: 'none' })
      this.setData({ showCreate: false })
      await this.loadFamilyInfo()
    } else {
      wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
    }
  },

  showJoinModal() { this.setData({ showJoin: true, inviteCode: '' }) },
  hideJoinModal() { this.setData({ showJoin: false }) },
  onInviteCodeInput(e) { this.setData({ inviteCode: e.detail.value.toUpperCase() }) },

  async confirmJoin() {
    const code = this.data.inviteCode.trim()
    if (!code || code.length !== 6) { wx.showToast({ title: '请输入6位邀请码', icon: 'none' }); return }

    wx.showLoading({ title: '加入中...' })
    const result = await family.manage('join', { inviteCode: code })
    wx.hideLoading()

    if (result.success) {
      wx.showToast({ title: `已加入 ${result.name}! 🎉`, icon: 'none' })
      this.setData({ showJoin: false })
      await this.loadFamilyInfo()
    } else {
      wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
    }
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.familyInfo.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' })
    })
  },

  // ========== 成员操作 ==========

  editNickname() {
    wx.showModal({
      title: '修改我的昵称', editable: true, placeholderText: '输入你在家庭中的昵称',
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const result = await family.manage('updateProfile', { nickname: res.content.trim() })
          if (result.success) { wx.showToast({ title: '已修改', icon: 'none' }); await this.loadFamilyInfo() }
        }
      }
    })
  },

  leaveFamily() {
    wx.showModal({
      title: '退出家庭', content: '确定退出当前家庭？退出后将无法查看家庭植物。',
      confirmColor: '#e53935',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' })
          const result = await family.manage('leave')
          wx.hideLoading()
          if (result.success) { family.clearCache(); wx.showToast({ title: '已退出', icon: 'none' }); await this.loadFamilyInfo() }
          else wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
        }
      }
    })
  },

  dissolveFamily() {
    wx.showModal({
      title: '⚠️ 解散家庭', content: '解散后所有家庭植物和记录将被永久删除，此操作不可撤销！',
      confirmColor: '#e53935',
      success: async (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '最后确认', content: `真的要解散「${this.data.familyInfo.name}」吗？`,
            confirmColor: '#e53935',
            success: async (res2) => {
              if (res2.confirm) {
                wx.showLoading({ title: '解散中...' })
                const result = await family.manage('dissolve')
                wx.hideLoading()
                if (result.success) { family.clearCache(); wx.showToast({ title: '已解散', icon: 'none' }); await this.loadFamilyInfo() }
                else wx.showToast({ title: result.error, icon: 'none' })
              }
            }
          })
        }
      }
    })
  },

  kickMember(e) {
    const idx = e.currentTarget.dataset.index
    const member = this.data.members[idx]
    if (!member) return

    wx.showModal({
      title: '移除成员', content: `确定要将 ${member.nickname || '该成员'} 移出家庭吗？`,
      confirmColor: '#e53935',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '移除中...' })
          const result = await family.manage('kick', { targetOpenid: member.openid })
          wx.hideLoading()
          if (result.success) { wx.showToast({ title: '已移除', icon: 'none' }); await this.loadFamilyInfo() }
          else wx.showToast({ title: result.error, icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    const info = this.data.familyInfo
    return { title: `邀请你加入「${info.name}」家庭花园`, path: `/pages/family/family?inviteCode=${info.inviteCode}` }
  },

  preventBubble() {}
})
