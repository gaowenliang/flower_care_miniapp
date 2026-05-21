// utils/theme.js — 夜间模式管理

/**
 * 检测系统主题
 */
function getSystemTheme() {
  try {
    const res = wx.getSystemInfoSync()
    return res.theme || 'light' // 'light' | 'dark'
  } catch (e) {
    return 'light'
  }
}

/**
 * 监听主题变化
 */
function onThemeChange(callback) {
  wx.onThemeChange((res) => {
    callback(res.theme)
  })
}

/**
 * 深色主题配色
 */
const DARK_THEME = {
  background: '#1A1A2E',
  cardBg: '#16213E',
  textPrimary: '#E8E8E8',
  textSecondary: '#8B8B9E',
  green: '#66BB6A',
  greenLight: '#1B3A1B',
  greenBg: '#0D2B0D',
  border: '#2A2A4A',
  inputBg: '#1E1E3A'
}

/**
 * 浅色主题配色
 */
const LIGHT_THEME = {
  background: '#F7F9F7',
  cardBg: '#FFFFFF',
  textPrimary: '#2D3436',
  textSecondary: '#90A4AE',
  green: '#4CAF50',
  greenLight: '#E8F5E9',
  greenBg: '#F7F9F7',
  border: '#F0F2F0',
  inputBg: '#F7F9F7'
}

function getThemeColors(isDark) {
  return isDark ? DARK_THEME : LIGHT_THEME
}

module.exports = {
  getSystemTheme,
  onThemeChange,
  getThemeColors,
  DARK_THEME,
  LIGHT_THEME
}
