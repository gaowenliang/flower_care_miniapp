// pages/import-screenshot/import-screenshot.js
const family = require('../../utils/family')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')

// actionType 映射

function _timer(page, fn, delay) {
  const id = setTimeout(fn, delay)
  page.data._timers.push(id)
  return id
}

const ACTION_TYPE_MAP = {
  'water': '浇水',
  'fertilize': '施肥',
  'prune': '修剪',
  'repot': '换盆',
  'pest': '除虫',
  'spray': '喷药',
  'loosen': '松土',
  'cutting': '扦插',
  'sow': '播种'
}

Page({
  data: {
    _timers: [],
    selectedImages: [],
    parsedRecords: [],
    selectedCount: 0,
    parsing: false,
    importing: false,
    showPlantPicker: false,
    selectedPlant: null,
    plants: []
  },

  onLoad() {
    this.loadPlants()
  },

  // ========== 加载植物列表 ==========
  async loadPlants() {
    const isFamilyMode = family.isInFamily()
    if (isFamilyMode) {
      const plants = await family.getPlants()
      this.setData({ plants })
    } else {
      const garden = storage.getGarden()
      this.setData({ plants: garden })
    }
  },

  // ========== 选择图片 ==========
  chooseImage() {
    const maxCount = 9 - this.data.selectedImages.length
    if (maxCount <= 0) {
      wx.showToast({ title: '最多选择 9 张', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          selectedImages: [...this.data.selectedImages, ...tempFiles]
        })
      }
    })
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.idx
    const images = this.data.selectedImages.filter((_, i) => i !== idx)
    this.setData({ selectedImages: images })
  },

  // ========== 上传并解析 ==========
  async parseImages() {
    if (this.data.selectedImages.length === 0) return

    this.setData({ parsing: true })

    try {
      // 上传到云存储
      const fileIDs = []
      for (const path of this.data.selectedImages) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `import-screenshot/${Date.now()}_${Math.random()}.jpg`,
          filePath: path
        })
        fileIDs.push(uploadRes.fileID)
      }

      // 调用云函数解析
      const res = await wx.cloud.callFunction({
        name: 'importScreenshot',
        data: { fileIDs }
      })

      const result = res.result
      if (!result.success) {
        wx.showToast({ title: result.error || '解析失败', icon: 'none' })
        return
      }

      // 处理解析结果
      console.debug('[importScreenshot] 云函数返回:', JSON.stringify(result).slice(0, 2000))
      const records = result.records.map(r => {
        // 尝试匹配植物
        const plantMatch = this.matchPlant(r.plantName)
        return {
          ...r,
          selected: true,
          plantMatch,
          note: r.raw || ''
        }
      })

      this.setData({
        parsedRecords: records,
        selectedCount: records.length
      })

      // 调试信息弹窗
      const ver = result._version || '旧版本(未更新)'
      const ocrPreview = (result.debug_ocr_text || '').slice(0, 300).replace(/\n/g, ' | ')
      console.debug('[importScreenshot] 版本:', ver)
      console.debug('[importScreenshot] OCR原文:', result.debug_ocr_text)
      console.debug('[importScreenshot] records数量:', records.length)
      if (records.length > 0) {
        console.debug('[importScreenshot] 第一条:', JSON.stringify(records[0]))
        console.debug('[importScreenshot] 最后一条:', JSON.stringify(records[records.length - 1]))
      }
      wx.showModal({
        title: '解析完成',
        content: `版本: ${ver}\n记录数: ${records.length}\n\nOCR前300字:\n${ocrPreview}`,
        confirmText: '确定'
      })

      // 删除云存储文件（清理临时文件）
      for (const fileID of fileIDs) {
        wx.cloud.deleteFile({ fileID }).catch(() => {})
      }

    } catch (e) {
      console.error('解析失败:', e)
      wx.showToast({ title: '解析失败，请重试', icon: 'none' })
    } finally {
      this.setData({ parsing: false })
    }
  },

  // ========== 植物名称模糊匹配 ==========
  matchPlant(ocrName) {
    if (!ocrName) return null
    const plants = this.data.plants
    // 精确匹配
    const exact = plants.find(p => p.nickname === ocrName || p.name === ocrName)
    if (exact) return exact.nickname

    // 包含匹配
    const includes = plants.find(p => 
      p.nickname.includes(ocrName) || 
      ocrName.includes(p.nickname) ||
      p.name.includes(ocrName)
    )
    if (includes) return includes.nickname

    return null
  },

  // ========== 操作解析结果 ==========
  toggleRecord(e) {
    const idx = e.currentTarget.dataset.idx
    const records = this.data.parsedRecords
    records[idx].selected = !records[idx].selected
    this.setData({
      parsedRecords: records,
      selectedCount: records.filter(r => r.selected).length
    })
  },

  deleteRecord(e) {
    const idx = e.currentTarget.dataset.idx
    const records = this.data.parsedRecords.filter((_, i) => i !== idx)
    this.setData({
      parsedRecords: records,
      selectedCount: records.filter(r => r.selected).length
    })
  },

  // ========== 返回 ==========
  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  // ========== 选择植物 ==========
  showPlantPicker() {
    this.setData({ showPlantPicker: true })
  },

  hidePlantPicker() {
    this.setData({ showPlantPicker: false })
  },

  selectPlant(e) {
    const plant = e.currentTarget.dataset.plant
    this.setData({ selectedPlant: plant, showPlantPicker: false })
  },

  // ========== 确认导入 ==========
  async confirmImport() {
    if (!this.data.selectedPlant) {
      wx.showToast({ title: '请先选择植物', icon: 'none' })
      return
    }

    const selectedRecords = this.data.parsedRecords.filter(r => r.selected)
    if (selectedRecords.length === 0) return

    this.setData({ importing: true })

    try {
      // 转换记录格式
      const records = selectedRecords.map(r => {
        const dateTs = r.date ? new Date(r.date).getTime() : Date.now()
        return {
          type: r.actionType || 'custom',
          typeName: r.action || '养护',
          date: dateTs,
          note: r.note || ''
        }
      })

      // 调用云函数批量导入
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: {
          action: 'batchImportRecords',
          records,
          plantId: this.data.selectedPlant._id
        }
      })

      const result = res.result
      if (!result.success) {
        wx.showToast({ title: result.error || '导入失败', icon: 'none' })
        return
      }

      let msg = `成功导入 ${result.imported} 条记录`
      if (result.skipped > 0) {
        msg += `，跳过 ${result.skipped} 条重复记录`
      }

      wx.showToast({ title: msg, icon: 'success', duration: 2000 })

      // 延迟返回
      _timer(this, () => {
        wx.navigateBack()
      }, 1500)

    } catch (e) {
      console.error('导入失败:', e)
      const errMsg = (e.errMsg || e.message || '').toString()
      wx.showModal({
        title: '导入失败',
        content: errMsg || '未知错误',
        showCancel: false
      })
    } finally {
      this.setData({ importing: false })
    }
  },

  preventBubble() {},

  onUnload() {
    this.data._timers.forEach(id => clearTimeout(id))
    this.data._timers = []
  }
})
