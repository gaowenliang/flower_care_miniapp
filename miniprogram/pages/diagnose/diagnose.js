// pages/diagnose/diagnose.js
const disease = require('../../utils/disease')

Page({
  data: {
    symptomText: '',
    results: [],
    showNoResult: false,
    activeTag: '',
    quickSymptoms: ['黄叶', '黑斑', '白粉', '烂根', '虫子', '干枯', '蔫了', '晒伤'],
    // AI拍照识别
    photoPath: '',
    aiResults: [],
    aiLoading: false,
    aiError: '',
    showAIResult: false
  },

  onInput(e) {
    this.setData({ symptomText: e.detail.value })
  },

  addSymptom(e) {
    const symptom = e.currentTarget.dataset.symptom
    const text = this.data.symptomText
    if (text.includes(symptom)) return
    const newText = text ? text + '、' + symptom : symptom
    this.setData({ symptomText: newText, activeTag: symptom })
  },

  startDiagnose() {
    const text = this.data.symptomText.trim()
    if (!text) return
    const results = disease.diagnose(text)
    this.setData({ results, showNoResult: results.length === 0, showAIResult: false })
  },

  // ========== AI拍照识别病虫害 ==========

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.identifyDisease(tempPath)
      }
    })
  },

  async identifyDisease(imagePath) {
    this.setData({ aiLoading: true, aiError: '', photoPath: imagePath, showAIResult: false, results: [], showNoResult: false })

    try {
      // 压缩转base64
      const base64 = await this._imageToBase64(imagePath)
      if (!base64) {
        this.setData({ aiError: '图片处理失败', aiLoading: false })
        return
      }

      // 调云函数识别病虫害
      const result = await this._callCloudDiagnose(base64)
      this.setData({ aiLoading: false })

      if (result && result.diseases && result.diseases.length > 0) {
        const aiResults = result.diseases.map(d => ({
          id: d.name,
          name: d.name,
          emoji: this._diseaseEmoji(d.name),
          severity: d.severity || 'medium',
          causes: d.cause || '未知原因',
          solutions: d.solutions || ['隔离病株', '改善通风', '适当控水'],
          score: d.score || 0
        }))
        this.setData({ aiResults, showAIResult: true })
      } else {
        this.setData({ aiError: result?.error || '未识别到病害，可以试试文字描述症状' })
      }
    } catch (e) {
      this.setData({ aiError: '识别失败，请重试', aiLoading: false })
    }
  },

  _imageToBase64(path) {
    return new Promise((resolve) => {
      wx.compressImage({
        src: path, quality: 40,
        success: (res) => {
          wx.getFileSystemManager().readFile({
            filePath: res.tempFilePath, encoding: 'base64',
            success: (r) => resolve(r.data),
            fail: () => resolve(null)
          })
        },
        fail: () => {
          wx.getFileSystemManager().readFile({
            filePath: path, encoding: 'base64',
            success: (r) => resolve(r.data),
            fail: () => resolve(null)
          })
        }
      })
    })
  },

  _callCloudDiagnose(base64) {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) { reject(new Error('云开发未启用')); return }
      wx.cloud.callFunction({
        name: 'diagnosePlant',
        data: { imageData: base64 },
        success: (res) => resolve(res.result),
        fail: (err) => reject(err)
      })
    })
  },

  _diseaseEmoji(name) {
    const map = {
      '黄叶': '🍂', '黑斑': '⚫', '白粉': '🤍', '烂根': '💀',
      '虫害': '🐛', '蚜虫': '🐛', '红蜘蛛': '🕷️', '介壳虫': '🪲',
      '枯萎': '🥀', '晒伤': '☀️', '缺水': '🏜️', '过浇': '🌊',
      '真菌': '🍄', '细菌': '🦠', '病毒': '🧬'
    }
    for (const [key, emoji] of Object.entries(map)) {
      if (name.includes(key)) return emoji
    }
    return '🔬'
  },

  // 从AI结果转为文字诊断格式
  useAIResult(e) {
    const idx = e.currentTarget.dataset.index
    const aiResult = this.data.aiResults[idx]
    if (!aiResult) return
    this.setData({
      results: [aiResult],
      showNoResult: false,
      symptomText: aiResult.name
    })
  },

  clearPhoto() {
    this.setData({ photoPath: '', aiResults: [], showAIResult: false, aiError: '' })
  }
})
