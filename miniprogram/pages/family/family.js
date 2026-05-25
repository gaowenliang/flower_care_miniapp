// pages/family/family.js — 家庭管理页面 v4
const family = require('../../utils/family')

Page({
  data: {
    loading: true, loadError: false, inFamily: false,
    familyInfo: null, myRole: '', members: [],
    leaderboard: [], myPoints: 0,
    // Tab: summary | members | report | wish | feed
    activeTab: 'summary',
    // 汇总
    weeklyReport: null, pkData: null, healthPlants: [], milestones: [],
    // 动态流
    activities: [],
    // 报表
    reportPeriod: 'week', reportData: null, reportLoading: false,
    // 心愿单
    wishlists: [], showAddWish: false, wishName: '', wishNote: '',
    // 设置面板
    showSettings: false,
    // 创建/加入
    showCreate: false, familyName: '',
    showJoin: false, inviteCode: '',
    colorMap: ['#4CAF50', '#FF9800', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722', '#795548']
  },

  async onLoad(options) {
    if (options && options.inviteCode) this.setData({ inviteCode: options.inviteCode, showJoin: true })
    await this.loadFamilyInfo()
    setTimeout(() => this.setData({ loading: false }), 200)
  },

  async onShow() {
    if (!this.data.loading) await this.loadFamilyInfo()
  },

  async loadFamilyInfo() {
    let result
    try {
      result = await family.refreshFamilyInfo()
    } catch (e) {
      this.setData({ loadError: true, loading: false })
      return
    }
    if (result.success && result.inFamily) {
      const members = (result.members || []).map((m, idx) => ({
        ...m, initial: (m.nickname || '用').charAt(0), color: this.data.colorMap[idx % this.data.colorMap.length]
      }))
      this.setData({
        inFamily: true, familyInfo: result.family, myRole: result.myRole, myPoints: result.myPoints || 0,
        members, leaderboard: members.sort((a, b) => (b.points || 0) - (a.points || 0)), loadError: false
      })
      this.loadTabData(this.data.activeTab)
    } else {
      this.setData({ inFamily: false, familyInfo: null, myRole: '', members: [], leaderboard: [], loadError: false })
    }
  },

  async retryLoad() {
    this.setData({ loadError: false, loading: true })
    await this.loadFamilyInfo()
    setTimeout(() => this.setData({ loading: false }), 200)
  },

  // ========== Tab ==========

  async switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    await this.loadTabData(tab)
  },

  async loadTabData(tab) {
    switch (tab) {
      case 'summary': await this.loadSummaryData(); break
      case 'plants': await this.loadPlantsBoard(); break
      case 'feed': await this.loadActivities(); break
      case 'report': if (!this.data.reportData) await this.loadReport(); break
      case 'wish': await this.loadWishlist(); break
    }
  },

  // ========== 汇总 ==========

  async loadSummaryData() {
    const [pkResult, reportResult] = await Promise.all([
      family.getPK('week'),
      family.getWeeklyReport()
    ])
    this.setData({
      pkData: pkResult.success ? pkResult : null,
      weeklyReport: reportResult.success ? reportResult.report : null
    })
  },

  async loadPlantsBoard() {
    const healthResult = await family.getHealthBoard()
    this.setData({ healthPlants: healthResult.success ? healthResult.plants : [] })
  },

  // ========== 动态流 ==========

  async loadActivities() {
    const acts = await family.getActivities(30)
    const timeEmoji = { care: '🌱', adopt: '🤝', join: '👋', leave: '🚪', wishlist: '💝', fulfill: '🎉', milestone: '🏆', photo: '📷', note: '📝', water: '💧' }
    const activities = acts.map(a => ({ ...a, emoji: timeEmoji[a.type] || '📋', timeAgo: this.timeAgo(a.createdAt) }))
    this.setData({ activities })
  },

  timeAgo(ts) {
    const diff = Date.now() - ts
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
    const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`
  },

  // ========== 报表 ==========

  switchPeriod(e) { this.setData({ reportPeriod: e.currentTarget.dataset.period }); this.loadReport() },
  async loadReport() {
    this.setData({ reportLoading: true })
    const result = await family.getReport(this.data.reportPeriod)
    if (result.success) {
      const maxTotal = Math.max(1, ...result.memberStats.map(m => m.total))
      const memberStats = result.memberStats.map(m => ({ ...m, barHeight: Math.max(8, (m.total / maxTotal) * 200) }))
      const typeEmoji = { '浇水': '💧', '施肥': '🧪', '修剪': '✂️', '换盆': '🏺', '喷药': '💉', '拍照记录': '📷', '备注': '📝' }
      const typeStats = Object.entries(result.typeStats || {}).map(([name, count]) => ({ name, count, emoji: typeEmoji[name] || '📋' })).sort((a, b) => b.count - a.count)
      this.setData({ reportData: { totalRecords: result.totalRecords, memberStats, typeStats, costStats: result.costStats || null }, reportLoading: false })
    } else { this.setData({ reportLoading: false }) }
  },

  // ========== 心愿单 ==========

  async loadWishlist() {
    const wishlists = await family.getWishlist()
    this.setData({ wishlists })
  },

  showAddWishModal() { this.setData({ showAddWish: true, wishName: '', wishNote: '' }) },
  hideAddWishModal() { this.setData({ showAddWish: false }) },
  onWishNameInput(e) { this.setData({ wishName: e.detail.value }) },
  onWishNoteInput(e) { this.setData({ wishNote: e.detail.value }) },
  async confirmAddWish() {
    const name = this.data.wishName.trim()
    if (!name) { wx.showToast({ title: '请输入植物名', icon: 'none' }); return }
    const result = await family.addWishlist(name, this.data.wishNote)
    if (result.success) { this.setData({ showAddWish: false }); wx.showToast({ title: '已添加 💝', icon: 'none' }); this.loadWishlist() }
    else wx.showToast({ title: result.error, icon: 'none' })
  },
  async fulfillWish(e) {
    const id = e.currentTarget.dataset.id
    const result = await family.fulfillWishlist(id)
    if (result.success) { wx.showToast({ title: '心愿达成! 🎉', icon: 'none' }); this.loadWishlist() }
  },
  async removeWish(e) {
    const id = e.currentTarget.dataset.id
    const result = await family.removeWishlist(id)
    if (result.success) { wx.showToast({ title: '已删除', icon: 'none' }); this.loadWishlist() }
  },

  // ========== 设置面板 ==========

  toggleSettings() { this.setData({ showSettings: !this.data.showSettings }) },
  closeSettings() { this.setData({ showSettings: false }) },

  copyInviteCode() {
    wx.setClipboardData({ data: this.data.familyInfo.inviteCode, success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' }) })
  },

  editNickname() {
    this.setData({ showSettings: false })
    wx.showModal({ title: '修改我的昵称', editable: true, placeholderText: '输入你在家庭中的昵称',
      success: async (res) => { if (res.confirm && res.content && res.content.trim()) { const r = await family.manage('updateProfile', { nickname: res.content.trim() }); if (r.success) { wx.showToast({ title: '已修改', icon: 'none' }); await this.loadFamilyInfo() } } }
    })
  },

  renameFamily() {
    this.setData({ showSettings: false })
    const currentName = this.data.familyInfo.name || ''
    wx.showModal({ title: '修改家庭名称', editable: true, placeholderText: '输入新名称', content: currentName,
      success: async (res) => { if (res.confirm && res.content && res.content.trim()) { const r = await family.manage('renameFamily', { name: res.content.trim() }); if (r.success) { wx.showToast({ title: '已修改', icon: 'none' }); await this.loadFamilyInfo() } else { wx.showToast({ title: r.error || '修改失败', icon: 'none' }) } } }
    })
  },

  leaveFamily() {
    this.setData({ showSettings: false })
    wx.showModal({ title: '退出家庭', content: '确定退出？', confirmColor: '#e53935',
      success: async (res) => { if (res.confirm) { wx.showLoading({ title: '退出中...' }); const r = await family.manage('leave'); wx.hideLoading(); if (r.success) { family.clearCache(); wx.showToast({ title: '已退出', icon: 'none' }); await this.loadFamilyInfo() } } }
    })
  },

  dissolveFamily() {
    this.setData({ showSettings: false })
    wx.showModal({ title: '⚠️ 解散家庭', content: '所有数据将被永久删除！', confirmColor: '#e53935',
      success: async (res) => {
        if (!res.confirm) return
        wx.showModal({ title: '最后确认', content: `真的解散「${this.data.familyInfo.name}」？`, confirmColor: '#e53935',
          success: async (r2) => {
            if (!r2.confirm) return
            wx.showLoading({ title: '解散中...' })
            const r = await family.manage('dissolve')
            wx.hideLoading()
            if (r.success) { family.clearCache(); wx.showToast({ title: '已解散', icon: 'none' }); await this.loadFamilyInfo() }
          }
        })
      }
    })
  },

  kickMember(e) {
    const member = this.data.members[e.currentTarget.dataset.index]; if (!member) return
    this.setData({ showSettings: false })
    wx.showModal({ title: '移除成员', content: `确定移除 ${member.nickname || '该成员'}？`, confirmColor: '#e53935',
      success: async (res) => { if (res.confirm) { wx.showLoading({ title: '移除中...' }); const r = await family.manage('kick', { targetOpenid: member.openid }); wx.hideLoading(); if (r.success) { wx.showToast({ title: '已移除', icon: 'none' }); await this.loadFamilyInfo() } } }
    })
  },

  // ========== 创建/加入 ==========

  showCreateModal() { this.setData({ showCreate: true, familyName: '' }) },
  hideCreateModal() { this.setData({ showCreate: false }) },
  onFamilyNameInput(e) { this.setData({ familyName: e.detail.value }) },
  async confirmCreate() {
    const name = this.data.familyName.trim()
    if (!name) { wx.showToast({ title: '请输入家庭名称', icon: 'none' }); return }
    wx.showLoading({ title: '创建中...' })
    const result = await family.manage('create', { name })
    wx.hideLoading()
    if (result.success) { wx.showToast({ title: '创建成功! 🏠', icon: 'none' }); this.setData({ showCreate: false }); await this.loadFamilyInfo() }
    else wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
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
    if (result.success) { wx.showToast({ title: `已加入 ${result.name}! 🎉`, icon: 'none' }); this.setData({ showJoin: false }); await this.loadFamilyInfo() }
    else wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
  },

  onShareAppMessage() {
    const info = this.data.familyInfo
    return { title: `邀请你加入「${info.name}」家庭花园`, path: `/pages/family/family?inviteCode=${info.inviteCode}` }
  },

  preventBubble() {}
})
