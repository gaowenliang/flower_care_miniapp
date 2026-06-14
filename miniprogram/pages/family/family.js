// pages/family/family.js — 家庭管理页面 v4
const family = require('../../utils/family')

function _timer(page, fn, delay) {
  const id = setTimeout(fn, delay)
  page.data._timers.push(id)
  return id
}

Page({
  data: {
    _timers: [],
    loading: true, loadError: false, inFamily: false,
    familyInfo: null, myRole: '', members: [],
    leaderboard: [], myPoints: 0,
    // Tab: summary | plants | stats | wish | feed
    activeTab: 'summary',
    // 汇总
    summaryStats: { totalPlants: 0, healthyCount: 0, warningCount: 0, totalCare: 0, continuousDays: 0 },
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
    _timer(this, () => this.setData({ loading: false }), 200)
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
    _timer(this, () => this.setData({ loading: false }), 200)
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
      case 'stats': await this.loadStatsTab(); break
      case 'feed': await this.loadActivities(); break
      case 'wish': await this.loadWishlist(); break
    }
  },

  // ========== 汇总 ==========

  async loadSummaryData() {
    const [pkResult, reportResult, healthResult] = await Promise.all([
      family.getPK('week'),
      family.getWeeklyReport(),
      family.getHealthBoard()
    ])
    // 汇总统计
    const healthPlants = healthResult.success ? healthResult.plants : []
    const totalPlants = healthPlants.length
    const healthyCount = healthPlants.filter(p => p.score >= 70).length
    const warningCount = healthPlants.filter(p => p.score < 70).length
    // 计算连续养护天数
    let continuousDays = 0
    if (reportResult.success && reportResult.report) {
      continuousDays = reportResult.report.continuousDays || 0
    }
    // 累计养护从成员积分推算
    const totalCare = this.data.leaderboard.reduce((s, m) => s + (m.totalCare || 0), 0)
    this.setData({
      pkData: pkResult.success ? pkResult : null,
      weeklyReport: reportResult.success ? reportResult.report : null,
      summaryStats: { totalPlants, healthyCount, warningCount, totalCare, continuousDays }
    })
  },

  async loadPlantsBoard() {
    const healthResult = await family.getHealthBoard()
    const plants = healthResult.success ? healthResult.plants : []
    // 获取认养信息
    const allPlants = family.getCachedPlants()
    const plantsWithAdopters = plants.map(p => {
      const cached = allPlants.find(cp => cp._id === p._id)
      return { ...p, adopterNames: cached ? (cached.adopterNames || []) : [] }
    })
    this.setData({ healthPlants: plantsWithAdopters })
  },

  // ========== 统计Tab（排行+报表合并） ==========

  async loadStatsTab() {
    await this.loadReport()
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
      const memberStats = result.memberStats.map(m => ({
        ...m,
        barHeight: Math.max(8, (m.total / maxTotal) * 200),
        initial: m.nickname ? m.nickname.charAt(0) : '?',
        color: this.data.colorMap[this.data.leaderboard.findIndex(lb => lb.openid === m.openid) % this.data.colorMap.length] || '#4CAF50',
        topTypes: Object.entries(m.byType || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([type, count]) => {
          const typeEmoji = { water: '💧', fertilize: '🧪', prune: '✂️', repot: '🏺', spray: '💉', photo: '📷', note: '📝', custom: '🌿', pest: '🐛', loosen: '🌱', postpone: '⏩' }
          const typeNameMap = { water: '浇水', fertilize: '施肥', prune: '修剪', repot: '换盆', spray: '喷药', photo: '拍照', note: '备注', custom: '养护', pest: '除虫', loosen: '松土', postpone: '推迟' }
          return { name: typeNameMap[type] || type, emoji: typeEmoji[type] || '📋', count }
        })
      }))
      const typeEmoji = { '浇水': '💧', '施肥': '🧪', '修剪': '✂️', '换盆': '🏺', '喷药': '💉', '拍照记录': '📷', '备注': '📝' }
      const maxTypeCount = Math.max(1, ...Object.values(result.typeStats || {}))
      const typeStats = Object.entries(result.typeStats || {}).map(([name, count]) => ({ name, count, emoji: typeEmoji[name] || '📋', percent: Math.round(count / maxTypeCount * 100) })).sort((a, b) => b.count - a.count)
      // 涉及植物数
      const plantIds = new Set()
      memberStats.forEach(m => { Object.keys(m.plants || {}).forEach(id => plantIds.add(id)) })
      this.setData({ reportData: { totalRecords: result.totalRecords, memberStats, typeStats, plantCount: plantIds.size, costStats: result.costStats || null }, reportLoading: false })
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
    wx.showModal({
      title: '修改我的昵称',
      editable: true,
      placeholderText: '输入你在家庭中的昵称',
      success: async (res) => {
        if (!res.confirm) return
        const nickname = (res.content || '').trim()
        if (!nickname) return
        const r = await family.manage('updateProfile', { nickname })
        if (r.success) {
          wx.showToast({ title: '已修改', icon: 'none' })
          await this.loadFamilyInfo()
        }
      }
    })
  },

  renameFamily() {
    this.setData({ showSettings: false })
    const currentName = this.data.familyInfo.name || ''
    wx.showModal({
      title: '修改家庭名称',
      editable: true,
      placeholderText: '输入新名称',
      content: currentName,
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return
        const r = await family.manage('renameFamily', { name })
        if (r.success) {
          wx.showToast({ title: '已修改', icon: 'none' })
          await this.loadFamilyInfo()
        } else {
          wx.showToast({ title: r.error || '修改失败', icon: 'none' })
        }
      }
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
    if (result.success) { wx.showToast({ title: '创建成功! 🏠', icon: 'none' }); this.setData({ showCreate: false }); await this.loadFamilyInfo(); _timer(this, () => wx.switchTab({ url: '/pages/index/index' }), 1000) }
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
    if (result.success) { wx.showToast({ title: `已加入 ${result.name}! 🎉`, icon: 'none' }); this.setData({ showJoin: false }); await this.loadFamilyInfo(); _timer(this, () => wx.switchTab({ url: '/pages/index/index' }), 1000) }
    else wx.showToast({ title: result.error, icon: 'none', duration: 2500 })
  },

  onShareAppMessage() {
    const info = this.data.familyInfo
    return { title: `邀请你加入「${info.name}」家庭花园`, path: `/pages/family/family?inviteCode=${info.inviteCode}` }
  },

  preventBubble() {},

  onUnload() {
    this.data._timers.forEach(id => clearTimeout(id))
    this.data._timers = []
  }
})
