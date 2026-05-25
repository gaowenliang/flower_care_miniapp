// utils/exif-date.js — 从图片 EXIF 中读取拍摄日期（轻量解析器）

/**
 * 从图片文件中读取 EXIF 拍摄日期
 * 返回 ISO 时间戳（毫秒），解析失败返回 null
 */
function getExifDate(filePath) {
  return new Promise((resolve) => {
    wx.getFileSystemManager().readFile({
      filePath,
      // 只读前 64KB，EXIF 头部在这个范围内
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
    // APP1 (EXIF)
    if (marker === 0xFFE1) {
      return parseExifBlock(view, offset + 4)
    }
    // 其他 marker 跳过
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
  offset += 6

  // TIFF header
  if (offset + 8 > view.byteLength) return null
  const byteOrder = view.getUint16(offset)
  const littleEndian = byteOrder === 0x4949 // 'II'
  // const magic = getU16(view, offset + 2, littleEndian) // 42
  const ifd0Offset = getU32(view, offset + 4, littleEndian)
  offset += ifd0Offset

  // IFD0
  const exifOffset = findTag(view, offset, littleEndian, 0x8769) // ExifIFD offset
  if (exifOffset === null) return null

  // ExifIFD 中找日期标签
  // 0x9003 = DateTimeOriginal, 0x9004 = DateTimeDigitized
  const dateTag = findTag(view, exifOffset, littleEndian, 0x9003) || findTag(view, exifOffset, littleEndian, 0x9004)
  if (dateTag === null) return null

  return dateTag
}

function findTag(view, ifdOffset, littleEndian, targetTag) {
  const baseOffset = ifdOffset
  if (baseOffset + 2 > view.byteLength) return null
  const count = getU16(view, baseOffset, littleEndian)

  for (let i = 0; i < count; i++) {
    const entryOffset = baseOffset + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = getU16(view, entryOffset, littleEndian)
    if (tag === targetTag) {
      const type = getU16(view, entryOffset + 2, littleEndian)
      const numValues = getU32(view, entryOffset + 4, littleEndian)
      // ASCII string (type=2)
      if (type === 2 && numValues > 0) {
        const valueOffset = numValues <= 4 ? entryOffset + 8 : getU32(view, entryOffset + 8, littleEndian)
        let str = ''
        for (let j = 0; j < numValues && valueOffset + j < view.byteLength; j++) {
          const ch = view.getUint8(valueOffset + j)
          if (ch === 0) break
          str += String.fromCharCode(ch)
        }
        // EXIF date format: "2026:05:25 14:30:00"
        return convertExifDate(str)
      }
      // 如果值偏移指向 IFD（tag 0x8769）
      return getU32(view, entryOffset + 8, littleEndian)
    }
  }
  return null
}

function convertExifDate(str) {
  // "2026:05:25 14:30:00" → "2026-05-25T14:30:00"
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
