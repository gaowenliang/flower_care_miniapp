// pages/plant-detail/task-manager-behavior.js — 任务管理相关逻辑
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const family = require('../../utils/family')

module.exports = Behavior({
  methods: {
    async completeTask(e) {
      wx.vibrateShort({ type: 'light' })
      const taskId = e.currentTarget.dataset.id
      const task = this.data.tasks.find(t => (t.id || t._id) === taskId)

      // 施肥类型选择
      if (task && task.type === 'fertilize') {
        this.setData({ showFertilizeModal: true, pendingFertilizeTaskId: taskId })
        return
      }

      await this._doCompleteTask(taskId)
    },

    // 施肥快捷选择
    selectFertilizeType(e) {
      const type = e.currentTarget.dataset.type
      this.setData({ fertilizeInput: type === '自定义' ? '' : type })
    },

    onFertilizeInput(e) {
      this.setData({ fertilizeInput: e.detail.value })
    },

    async confirmFertilize() {
      const { pendingFertilizeTaskId, fertilizeInput } = this.data
      const note = fertilizeInput ? `施肥(${fertilizeInput})` : '施肥'
      this.setData({ showFertilizeModal: false, fertilizeInput: '' })

      await this._doCompleteTask(pendingFertilizeTaskId, note)
    },

    cancelFertilize() {
      this.setData({ showFertilizeModal: false, fertilizeInput: '', pendingFertilizeTaskId: '' })
    },

    async _doCompleteTask(taskId, note) {
      const task = this.data.tasks.find(t => (t.id || t._id) === taskId)

      if (this.data.isFamilyMode) {
        const result = await family.completeTask(taskId, note)
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' }); return
        }
        wx.showToast({ title: '完成啦~', icon: 'none' })
        await this.loadFamilyTasks()
        await this.loadFamilyRecords()
        return
      }

      // 个人模式
      storage.completeTask(taskId)
      // 追加带肥料类型的记录
      if (note) {
        const records = storage.getRecords()
        if (records.length > 0 && records[0].userPlantId === this.data.userPlant.id) {
          records[0].note = note
          try { wx.setStorageSync('careRecords', records) } catch (e) {}
        }
      }
      this.loadTasks()
      this.loadRecords()
      this.loadHealthScore()
      wx.showToast({ title: '完成啦~', icon: 'none' })
    },

    changeInterval(e) {
      const { taskId, delta } = e.currentTarget.dataset
      if (this.data.isFamilyMode) {
        const task = this.data.tasks.find(t => t.id === taskId || t._id === taskId)
        if (task) {
          const newInterval = Math.max(1, (task.intervalDays || 7) + parseInt(delta))
          family.updateTask(taskId, { intervalDays: newInterval }).then(() => this.loadFamilyTasks()).catch(() => {})
        }
        return
      }
      const tasks = storage.getTasksByPlant(this.data.userPlant.id)
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        const newInterval = Math.max(1, task.intervalDays + parseInt(delta))
        storage.updateTaskInterval(taskId, newInterval)
      }
      this.loadTasks()
    },

    toggleTask(e) {
      const taskId = e.currentTarget.dataset.id
      if (this.data.isFamilyMode) {
        family.toggleTask(taskId).then(() => this.loadFamilyTasks()).catch(() => {})
        return
      }
      storage.toggleTask(taskId)
      this.loadTasks()
    },

    // 添加新养护任务
    showAddTaskModal() {
      this.setData({ showAddTask: true })
    },

    hideAddTaskModal() {
      this.setData({ showAddTask: false })
    },

    selectTaskType(e) {
      this.setData({ newTaskType: e.currentTarget.dataset.type })
      // 根据类型设置默认间隔
      const defaults = { water: 7, fertilize: 30, prune: 60, repot: 180, spray: 14 }
      this.setData({ newTaskInterval: defaults[this.data.newTaskType] || 7 })
    },

    onIntervalInput(e) {
      this.setData({ newTaskInterval: parseInt(e.detail.value) || 1 })
    },

    async confirmAddTask() {
      const { newTaskType, newTaskInterval, userPlant, taskTypes } = this.data
      const taskType = taskTypes.find(t => t.id === newTaskType)

      if (this.data.isFamilyMode) {
        wx.showLoading({ title: '添加中...' })
        const result = await family.data('addTask', {
          task: {
            plantId: userPlant._id,
            type: newTaskType,
            typeName: taskType ? taskType.name : '养护',
            intervalDays: newTaskInterval
          }
        })
        wx.hideLoading()
        if (result.success) {
          this.setData({ showAddTask: false })
          await this.loadFamilyTasks()
          wx.showToast({ title: '任务已添加', icon: 'none' })
        } else {
          wx.showToast({ title: result.error || '添加失败', icon: 'none' })
        }
        return
      }

      storage.addTask({
        id: util.genId(),
        userPlantId: userPlant.id,
        type: newTaskType,
        typeName: taskType ? taskType.name : '养护',
        intervalDays: newTaskInterval,
        nextDate: util.nextCareDate(Date.now(), newTaskInterval),
        lastDoneDate: Date.now(),
        enabled: true
      })

      this.setData({ showAddTask: false })
      this.loadTasks()
      wx.showToast({ title: '任务已添加', icon: 'none' })
    },

    showMoreActions() {
      // ⚠️ wx.showActionSheet itemList 最大长度为6，不能超
      const items = ['📝 添加备注', '📤 分享报告', '🩺 诊断病害', '🔖 补卡记录']
      if (this.data.userPlant.dead) {
        items.push('🌱 复活')
      } else {
        items.push('💀 标记嘎了')
      }
      items.push('🗑️ 删除植物')

      wx.showActionSheet({
        alertText: this.data.userPlant.nickname,
        itemList: items,
        success: (res) => {
          switch (res.tapIndex) {
            case 0: this.addNote(); break
            case 1: this.shareReport(); break
            case 2: this.goDiagnose(); break
            case 3: this.retroCard(); break
            case 4: this.markDead(); break
            case 5: this.deletePlant(); break
          }
        },
        fail: (err) => {
          if (err.errMsg !== 'fail cancel') {
            console.error('showMoreActions error:', err)
          }
        }
      })
    }
  }
})
