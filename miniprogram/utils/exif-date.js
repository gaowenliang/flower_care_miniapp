// utils/exif-date.js — 从图片 EXIF 中读取拍摄日期（轻量解析器）

/**
 * 从图片文件中读取 EXIF 拍摄日期
 * 返回 ISO 时间戳（毫秒），解析失败返回 null
 */
function getExifDate(filePath) {
  return new Promise((resolve) => {
    wx.getFileSystemManager().readFile({
      filePath,
      length: 65536,
      success: (res) => {
        try {
          const dateStr = parseExifDate(res.data)
          resolve(dateStr ? new Date(dateStr).getTime() : null)
        } catch (e) {
          resolve(null)
        }
      },
      fail: () => resolve(null)
    })
  })
}

function parseExifDate(buffer) {
  const view = new DataView(buffer)

  // 检查 JPEG
  if (view.getUint16(0) !== 0xFFD8) return null

  let offset = 2
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset)
    if (marker === 0xFFE1) {
      return parseExifBlock(view, offset + 4)
    }
    if ((marker & 0xFF00) !== 0xFF00) break
    const segLen = view.getUint16(offset + 2)
    offset += 2 + segLen
  }
  return null
}

function parseExifBlock(view, offset) {
  // 检查 "Exif\0\0"
  if (offset + 6 > view.byteLength) return null
  let sig = ''
  for (let i = 0; i < 4; i++) sig += String.fromCharCode(view.getUint8(offset + i))
  if (sig !== 'Exif') return null
  offset += 6  // 现在 offset 指向 TIFF header 起始（绝对偏移）

  // TIFF header: byte order(2) + magic(2) + IFD0 offset(4)
  if (offset + 8 > view.byteLength) return null
  const tiffStart = offset  // TIFF header 的绝对位置
  const byteOrder = view.getUint16(tiffStart)
  const littleEndian = byteOrder === 0x4949 // 'II'
  const ifd0Offset = getU32(view, tiffStart + 4, littleEndian)

  // IFD0 的绝对位置 = tiffStart + 相对偏移
  const ifd0Abs = tiffStart + ifd0Offset
  if (ifd0Abs + 2 > view.byteLength) return null

  // 在 IFD0 中找 ExifIFD 指针 (tag 0x8769)
  const exifIFDOffset = findIFDOffset(view, ifd0Abs, littleEndian, 0x8769)
  if (exifIFDOffset === null) return null

  // ExifIFD 的绝对位置
  const exifIFDAbs = tiffStart + exifIFDOffset
  if (exifIFDAbs + 2 > view.byteLength) return null

  // 在 ExifIFD 中找日期标签 (tag 0x9003 DateTimeOriginal)
  const dateStr = findStringTag(view, exifIFDAbs, tiffStart, littleEndian, 0x9003)
    || findStringTag(view, exifIFDAbs, tiffStart, littleEndian, 0x9004)
  if (!dateStr) return null

  return convertExifDate(dateStr)
}

/**
 * 在 IFD 中查找一个 LONG 类型的偏移值（如 ExifIFDPointer）
 * 返回相对于 TIFF header 的偏移量，失败返回 null
 */
function findIFDOffset(view, ifdAbs, littleEndian, targetTag) {
  if (ifdAbs + 2 > view.byteLength) return null
  const count = getU16(view, ifdAbs, littleEndian)
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdAbs + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = getU16(view, entryOffset, littleEndian)
    if (tag === targetTag) {
      // 返回 LONG 值（相对于 TIFF header 的偏移）
      return getU32(view, entryOffset + 8, littleEndian)
    }
  }
  return null
}

/**
 * 在 IFD 中查找一个 ASCII 字符串标签
 * tiffStart: TIFF header 绝对位置（用于计算字符串值的绝对偏移）
 * 返回字符串值，失败返回 null
 */
function findStringTag(view, ifdAbs, tiffStart, littleEndian, targetTag) {
  if (ifdAbs + 2 > view.byteLength) return null
  const count = getU16(view, ifdAbs, littleEndian)
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdAbs + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = getU16(view, entryOffset, littleEndian)
    if (tag === targetTag) {
      const type = getU16(view, entryOffset + 2, littleEndian)
      const numValues = getU32(view, entryOffset + 4, littleEndian)
      if (type === 2 && numValues > 0) {
        // ASCII string：<=4字节存在 entry 内，>4字节存储的是相对于 TIFF header 的偏移
        let valueAbs
        if (numValues <= 4) {
          valueAbs = entryOffset + 8
        } else {
          const relOffset = getU32(view, entryOffset + 8, littleEndian)
          valueAbs = tiffStart + relOffset
        }
        let str = ''
        for (let j = 0; j < numValues && valueAbs + j < view.byteLength; j++) {
          const ch = view.getUint8(valueAbs + j)
          if (ch === 0) break
          str += String.fromCharCode(ch)
        }
        return str
      }
      return null
    }
  }
  return null
}

function convertExifDate(str) {
  const match = str.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`
}

function getU16(view, offset, le) {
  return le ? view.getUint16(offset, true) : view.getUint16(offset, false)
}

function getU32(view, offset, le) {
  return le ? view.getUint32(offset, true) : view.getUint32(offset, false)
}

module.exports = { getExifDate }
