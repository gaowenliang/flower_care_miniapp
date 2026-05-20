// pages/diagnose/diagnose.js
const disease = require('../../utils/disease')

Page({
  data: {
    symptomText: '',
    results: [],
    showNoResult: false,
    activeTag: '',
    quickSymptoms: ['黄叶', '黑斑', '白粉', '烂根', '虫子', '干枯', '蔫了', '晒伤']
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
    this.setData({ results, showNoResult: results.length === 0 })
  }
})
