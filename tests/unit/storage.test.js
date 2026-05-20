/**
 * 养花助手 - StorageManager 单元测试
 * 
 * 测试 utils/storage.js 的数据操作逻辑
 * 注意：wx API 在 Node 环境中需要 mock
 */

// Mock wx API
const mockStorage = {}

global.wx = {
  getStorageSync: jest.fn((key) => mockStorage[key] || ''),
  setStorageSync: jest.fn((key, value) => { mockStorage[key] = value }),
  removeStorageSync: jest.fn((key) => { delete mockStorage[key] }),
  clearStorageSync: jest.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) })
}

const storage = require('../../miniprogram/utils/storage')
const util = require('../../miniprogram/utils/util')

beforeEach(() => {
  wx.clearStorageSync()
})

// ============ 花园 CRUD ============
describe('StorageManager - 花园', () => {
  const testPlant = {
    id: 'test_001',
    plantId: 'pothos',
    name: '绿萝',
    emoji: '🌿',
    nickname: '小绿',
    location: '阳台',
    addedAt: Date.now()
  }

  test('空花园返回空数组', () => {
    expect(storage.getGarden()).toEqual([])
  })

  test('添加植物', () => {
    const result = storage.addPlant(testPlant)
    expect(result.length).toBe(1)
    expect(result[0].nickname).toBe('小绿')
  })

  test('获取单个植物', () => {
    storage.addPlant(testPlant)
    const plant = storage.getPlantById('test_001')
    expect(plant).toBeTruthy()
    expect(plant.nickname).toBe('小绿')
  })

  test('获取不存在的植物返回null', () => {
    expect(storage.getPlantById('not_exist')).toBeNull()
  })

  test('更新植物', () => {
    storage.addPlant(testPlant)
    storage.updatePlant('test_001', { nickname: '大绿', location: '客厅' })
    const plant = storage.getPlantById('test_001')
    expect(plant.nickname).toBe('大绿')
    expect(plant.location).toBe('客厅')
    expect(plant.updatedAt).toBeDefined()
  })

  test('删除植物', () => {
    storage.addPlant(testPlant)
    storage.addTask({
      id: 'task_001', userPlantId: 'test_001', type: 'water',
      typeName: '浇水', intervalDays: 7, nextDate: Date.now() + 86400000 * 7,
      lastDoneDate: Date.now(), enabled: true
    })

    storage.removePlant('test_001')
    expect(storage.getGarden().length).toBe(0)
    expect(storage.getTasksByPlant('test_001').length).toBe(0)
  })
})

// ============ 任务 CRUD ============
describe('StorageManager - 任务', () => {
  const testTask = {
    id: 'task_001',
    userPlantId: 'plant_001',
    type: 'water',
    typeName: '浇水',
    intervalDays: 7,
    nextDate: Date.now() + 86400000 * 7,
    lastDoneDate: Date.now(),
    enabled: true
  }

  test('空任务返回空数组', () => {
    expect(storage.getTasks()).toEqual([])
  })

  test('添加任务', () => {
    storage.addTask(testTask)
    expect(storage.getTasks().length).toBe(1)
  })

  test('按植物查询任务', () => {
    storage.addTask(testTask)
    storage.addTask({ ...testTask, id: 'task_002', userPlantId: 'plant_002' })
    
    const tasks = storage.getTasksByPlant('plant_001')
    expect(tasks.length).toBe(1)
    expect(tasks[0].id).toBe('task_001')
  })

  test('获取活跃任务', () => {
    storage.addTask(testTask)
    storage.addTask({ ...testTask, id: 'task_002', enabled: false })
    
    const active = storage.getActiveTasks()
    expect(active.length).toBe(1)
  })

  test('完成任务并更新日期', () => {
    storage.addTask(testTask)
    const before = storage.getTasks()[0].nextDate
    
    storage.completeTask('task_001')
    const after = storage.getTasks()[0].nextDate
    
    expect(after).toBeGreaterThan(before)
    expect(storage.getRecords().length).toBe(1) // 自动记录
  })

  test('修改任务间隔', () => {
    storage.addTask(testTask)
    storage.updateTaskInterval('task_001', 14)
    
    const task = storage.getTasks()[0]
    expect(task.intervalDays).toBe(14)
  })

  test('间隔最小为1天', () => {
    storage.addTask(testTask)
    storage.updateTaskInterval('task_001', 0)
    
    expect(storage.getTasks()[0].intervalDays).toBe(1)
  })

  test('暂停/恢复任务', () => {
    storage.addTask(testTask)
    
    storage.toggleTask('task_001')
    expect(storage.getTasks()[0].enabled).toBe(false)
    
    storage.toggleTask('task_001')
    expect(storage.getTasks()[0].enabled).toBe(true)
  })

  test('删除植物时级联删除任务', () => {
    storage.addPlant({ id: 'plant_001', nickname: 'test' })
    storage.addTask(testTask)
    
    storage.removePlant('plant_001')
    expect(storage.getTasksByPlant('plant_001').length).toBe(0)
  })
})

// ============ 养护记录 ============
describe('StorageManager - 养护记录', () => {
  test('添加记录', () => {
    storage.addRecord({ id: 'r_001', type: 'water', typeName: '浇水', date: Date.now() })
    expect(storage.getRecords().length).toBe(1)
  })

  test('按植物查询记录', () => {
    storage.addRecord({ id: 'r_001', userPlantId: 'p1', type: 'water', date: Date.now() })
    storage.addRecord({ id: 'r_002', userPlantId: 'p2', type: 'water', date: Date.now() })
    
    expect(storage.getRecordsByPlant('p1').length).toBe(1)
  })

  test('记录最多保留500条', () => {
    for (let i = 0; i < 510; i++) {
      storage.addRecord({ id: `r_${i}`, type: 'water', date: Date.now() })
    }
    expect(storage.getRecords().length).toBe(500)
  })
})

// ============ 设置 ============
describe('StorageManager - 设置', () => {
  test('默认设置', () => {
    const settings = storage.getSettings()
    expect(settings.reminderEnabled).toBe(true)
    expect(settings.reminderTime).toBe('09:00')
  })

  test('保存设置', () => {
    storage.saveSettings({ reminderEnabled: false, reminderTime: '10:00' })
    const settings = storage.getSettings()
    expect(settings.reminderEnabled).toBe(false)
    expect(settings.reminderTime).toBe('10:00')
  })
})

// ============ 统计 ============
describe('StorageManager - 统计', () => {
  test('空花园统计', () => {
    const stats = storage.getStats()
    expect(stats.totalPlants).toBe(0)
    expect(stats.totalRecords).toBe(0)
    expect(stats.dueToday).toBe(0)
  })

  test('正常统计', () => {
    storage.addPlant({ id: 'p1', category: '绿植', addedAt: Date.now() })
    storage.addPlant({ id: 'p2', category: '多肉', addedAt: Date.now() })
    storage.addPlant({ id: 'p3', category: '绿植', addedAt: Date.now() })
    
    // 一个到期任务
    storage.addTask({
      id: 't1', userPlantId: 'p1', type: 'water', typeName: '浇水',
      intervalDays: 7, nextDate: Date.now() - 86400000, lastDoneDate: Date.now(), enabled: true
    })
    // 一个未到期任务
    storage.addTask({
      id: 't2', userPlantId: 'p2', type: 'water', typeName: '浇水',
      intervalDays: 7, nextDate: Date.now() + 86400000 * 7, lastDoneDate: Date.now(), enabled: true
    })
    
    storage.addRecord({ id: 'r1', userPlantId: 'p1', type: 'water', date: Date.now() })

    const stats = storage.getStats()
    expect(stats.totalPlants).toBe(3)
    expect(stats.dueToday).toBe(1)
    expect(stats.totalRecords).toBe(1)
    expect(stats.categories['绿植']).toBe(2)
    expect(stats.categories['多肉']).toBe(1)
  })
})
