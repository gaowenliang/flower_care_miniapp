/**
 * 养花助手 - 功能测试
 * 
 * 使用 miniprogram-automator 进行页面级自动化测试
 * 运行方式：npm run test:functional
 * 
 * 前置条件：
 * 1. 安装微信开发者工具 CLI
 * 2. npm install miniprogram-automator --save-dev
 */

const automator = require('miniprogram-automator')

let miniProgram

beforeAll(async () => {
  miniProgram = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/path/to/flower-care-miniapp'
  })
}, 60000)

afterAll(async () => {
  if (miniProgram) {
    await miniProgram.close()
  }
})

// ============ 首页测试 ============
describe('首页 - 我的花园', () => {
  let page

  beforeEach(async () => {
    page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1000)
  })

  test('页面正常渲染', async () => {
    const title = await page.data('hasPlants')
    expect(title).toBeDefined()
  })

  test('空花园显示引导', async () => {
    const hasPlants = await page.data('hasPlants')
    if (!hasPlants) {
      // 空状态应该有添加按钮
      const addBtn = await page.$('.btn-primary')
      expect(addBtn).toBeTruthy()
    }
  })

  test('花园有植物时显示列表', async () => {
    const garden = await page.data('garden')
    if (garden && garden.length > 0) {
      const hasPlants = await page.data('hasPlants')
      expect(hasPlants).toBe(true)
    }
  })
})

// ============ 添加植物测试 ============
describe('添加植物页', () => {
  let page

  beforeEach(async () => {
    page = await miniProgram.reLaunch('/pages/add-plant/add-plant')
    await page.waitFor(1000)
  })

  test('植物列表不为空', async () => {
    const plants = await page.data('filteredPlants')
    expect(plants.length).toBeGreaterThan(0)
  })

  test('搜索功能', async () => {
    // 模拟搜索输入
    await page.setData({ keyword: '绿萝', searching: true })
    // 手动触发 filterPlants
    await page.callMethod('filterPlants')
    await page.waitFor(500)

    const filtered = await page.data('filteredPlants')
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    expect(filtered[0].name).toContain('绿萝')
  })

  test('分类筛选', async () => {
    await page.setData({ activeCategory: '多肉' })
    await page.callMethod('filterPlants')
    await page.waitFor(500)

    const filtered = await page.data('filteredPlants')
    filtered.forEach(p => {
      expect(p.category).toBe('多肉')
    })
  })

  test('选择植物弹出确认弹窗', async () => {
    const filtered = await page.data('filteredPlants')
    if (filtered.length > 0) {
      await page.callMethod('selectPlant', { 
        currentTarget: { dataset: { id: filtered[0].id } } 
      })
      await page.waitFor(500)

      const showModal = await page.data('showModal')
      expect(showModal).toBe(true)

      const selected = await page.data('selectedPlant')
      expect(selected).toBeTruthy()
    }
  })

  test('添加植物到花园', async () => {
    const filtered = await page.data('filteredPlants')
    if (filtered.length > 0) {
      // 先选择植物
      await page.setData({ 
        selectedPlant: filtered[0],
        showModal: true,
        nickName: '测试小花',
        location: '阳台'
      })

      // 执行添加
      await page.callMethod('confirmAdd')
      await page.waitFor(1000)

      // 验证存储
      const garden = await miniProgram.callWxMethod('getStorageSync', 'myGarden')
      const found = garden.find(p => p.nickname === '测试小花')
      expect(found).toBeTruthy()
    }
  })
})

// ============ 植物详情测试 ============
describe('植物详情页', () => {
  test('能正确加载植物信息', async () => {
    // 先添加一个测试植物
    const testPlant = {
      id: 'test_001',
      plantId: 'pothos',
      name: '绿萝',
      latin: 'Epipremnum aureum',
      emoji: '🌿',
      category: '绿植',
      nickname: '小绿',
      location: '阳台',
      addedAt: Date.now()
    }
    await miniProgram.callWxMethod('setStorageSync', 'myGarden', [testPlant])

    const page = await miniProgram.reLaunch(`/pages/plant-detail/plant-detail?id=test_001`)
    await page.waitFor(1000)

    const userPlant = await page.data('userPlant')
    expect(userPlant).toBeTruthy()
    expect(userPlant.nickname).toBe('小绿')

    const plantInfo = await page.data('plantInfo')
    expect(plantInfo).toBeTruthy()
    expect(plantInfo.name).toBe('绿萝')
  })

  test('Tab切换正常', async () => {
    const testPlant = {
      id: 'test_002', plantId: 'pothos', name: '绿萝', 
      latin: 'Epipremnum aureum', emoji: '🌿', category: '绿植',
      nickname: '小绿', location: '阳台', addedAt: Date.now()
    }
    await miniProgram.callWxMethod('setStorageSync', 'myGarden', [testPlant])

    const page = await miniProgram.reLaunch(`/pages/plant-detail/plant-detail?id=test_002`)
    await page.waitFor(1000)

    // 默认是 care tab
    expect(await page.data('activeTab')).toBe('care')

    // 切换到 tips
    await page.callMethod('switchTab', { currentTarget: { dataset: { tab: 'tips' } } })
    expect(await page.data('activeTab')).toBe('tips')
  })

  test('删除植物', async () => {
    const testPlant = {
      id: 'test_003', plantId: 'pothos', name: '绿萝',
      latin: 'Epipremnum aureum', emoji: '🌿', category: '绿植',
      nickname: '待删除', location: '阳台', addedAt: Date.now()
    }
    await miniProgram.callWxMethod('setStorageSync', 'myGarden', [testPlant])

    const page = await miniProgram.reLaunch(`/pages/plant-detail/plant-detail?id=test_003`)
    await page.waitFor(1000)

    // 模拟确认删除
    await page.callMethod('deletePlant')
    await page.waitFor(500)
  })
})

// ============ 日历页测试 ============
describe('养护日历', () => {
  test('日历正常渲染', async () => {
    const page = await miniProgram.reLaunch('/pages/calendar/calendar')
    await page.waitFor(1000)

    const days = await page.data('days')
    expect(days.length).toBeGreaterThan(0)
  })

  test('月份切换', async () => {
    const page = await miniProgram.reLaunch('/pages/calendar/calendar')
    await page.waitFor(1000)

    const oldMonth = await page.data('month')
    await page.callMethod('nextMonth')
    await page.waitFor(500)
    const newMonth = await page.data('month')
    expect(newMonth).not.toBe(oldMonth)
  })
})

// ============ 端到端流程测试 ============
describe('完整流程', () => {
  test('添加植物 → 查看详情 → 删除', async () => {
    // 1. 清空数据
    await miniProgram.callWxMethod('removeStorageSync', 'myGarden')
    await miniProgram.callWxMethod('removeStorageSync', 'careTasks')

    // 2. 进入首页（空状态）
    let page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1000)
    expect(await page.data('hasPlants')).toBe(false)

    // 3. 进入添加页
    page = await miniProgram.switchTab('/pages/add-plant/add-plant')
    await page.waitFor(1000)

    // 4. 选择第一个植物
    const filtered = await page.data('filteredPlants')
    await page.setData({
      selectedPlant: filtered[0],
      showModal: true,
      nickName: 'E2E测试植物',
      location: '阳台'
    })
    await page.callMethod('confirmAdd')
    await page.waitFor(1500)

    // 5. 回到首页确认
    page = await miniProgram.switchTab('/pages/index/index')
    await page.waitFor(1000)
    expect(await page.data('hasPlants')).toBe(true)
    const garden = await page.data('garden')
    expect(garden.length).toBe(1)

    // 6. 进入详情页
    const plantId = garden[0].id
    page = await miniProgram.navigateTo(`/pages/plant-detail/plant-detail?id=${plantId}`)
    await page.waitFor(1000)
    const userPlant = await page.data('userPlant')
    expect(userPlant.nickname).toBe('E2E测试植物')

    // 7. 清理
    await miniProgram.callWxMethod('removeStorageSync', 'myGarden')
    await miniProgram.callWxMethod('removeStorageSync', 'careTasks')
  })
})
