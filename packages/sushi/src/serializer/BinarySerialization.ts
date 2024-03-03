import { Address } from 'viem'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const floatArray = new Float64Array(1)
const floatArrayAsUint8 = new Uint8Array(floatArray.buffer)
const MAX_BYTE2_VALUE = (1 << 16) - 1
const MAX_BYTE3_VALUE = (1 << 24) - 1
const MAX_BYTE4_VALUE = 2 ** 32 - 1
const INT24_SHIFT = 1 << 23

// TODO: try Uint16/32Array ot DataView instaed of manual work
export class BinWriteStream {
  data: Uint8Array
  position = 0

  constructor(primarySize = 2 ** 15) {
    this.data = new Uint8Array(primarySize)
  }

  getSerializedData(): Uint8Array {
    return this.data.subarray(0, this.position)
  }

  ensurePlace(bytes: number) {
    if (this.position + bytes <= this.data.byteLength) return
    const data = new Uint8Array(this.data.byteLength * 2)
    data.set(this.data)
    this.data = data
    this.ensurePlace(bytes)
  }

  uint8(num: number) {
    if (num > 255 || !Number.isInteger(num))
      console.error(`uint8 serialization error ${num}`)
    this.ensurePlace(1)
    this.data[this.position++] = num
  }

  uint16(num: number) {
    if (num > MAX_BYTE2_VALUE || !Number.isInteger(num))
      console.error(`uint16 serialization error ${num}`)
    this.ensurePlace(2)
    this.data[this.position++] = num % 256
    this.data[this.position++] = num / 256
  }

  uint24(num: number) {
    if (num > MAX_BYTE3_VALUE || !Number.isInteger(num))
      console.error(`uint24 serialization error ${num}`)
    this.ensurePlace(3)
    this.data[this.position++] = num % 256
    num /= 256
    this.data[this.position++] = num % 256
    num /= 256
    this.data[this.position++] = num % 256
  }

  int24(num: number) {
    this.uint24(num + INT24_SHIFT)
  }

  uint32(num: number) {
    if (num > MAX_BYTE4_VALUE || !Number.isInteger(num))
      console.error(`uint32 serialization error ${num}`)
    this.ensurePlace(4)
    for (let i = 0; i < 4; ++i) {
      this.data[this.position++] = num % 256
      num /= 256
    }
  }

  float64(num: number) {
    this.ensurePlace(8)
    floatArray[0] = num
    this.data.set(floatArrayAsUint8, this.position)
    this.position += 8
  }

  bigUInt(num: bigint) {
    if (num < 0) {
      console.error(`Serialization error: Negative bigint value ${num}`)
      num = -num
    }
    this.ensurePlace(257)
    for (let i = 0, pos = this.position; i < 255; ++i) {
      if (num === 0n) {
        this.data[this.position] = i
        this.position += i + 1
        return
      }
      this.data[++pos] = Number(num % 256n)
      num >>= 8n
    }
    console.error('Serialization error: too huge bigint')
    this.data[this.position] = 255
    this.position += 256
  }

  bigInt(num: bigint) {
    if (num > 0) this.bigUInt(num)
    else {
      const pos = this.position
      this.bigUInt(-num)
      if ((this.data[pos] as number) > 127)
        console.error('Serialization error: too huge negative bigint')
      this.data[pos] += 128
    }
  }

  str16UTF8(s: string) {
    this.ensurePlace(s.length * 4 + 2)
    const { read, written } = textEncoder.encodeInto(
      s,
      this.data.subarray(
        this.position + 2,
        this.position + 2 + Math.min(s.length * 4, MAX_BYTE2_VALUE),
      ),
    )
    if (read !== s.length)
      console.error(
        `String serialization error: ${read} symbols were read instead of ${s.length}`,
      )
    this.uint16(written)
    this.position += written
  }

  str16UTF16(s: string) {
    if (s.length >= MAX_BYTE2_VALUE) {
      console.error(
        `String serialization error: string length is ${s.length}, will be trimmed to ${MAX_BYTE2_VALUE}`,
      )
      s = s.substring(0, MAX_BYTE2_VALUE)
    }
    const length = s.length
    this.ensurePlace(length * 2 + 2)
    this.data[this.position++] = length % 256
    this.data[this.position++] = length / 256
    for (let i = 0; i < length; ++i) {
      const code = s.charCodeAt(i)
      this.data[this.position++] = code % 256
      this.data[this.position++] = code / 256
    }
  }

  str16(s: string) {
    return this.str16UTF8(s) // should be faster
  }

  // addressCompact(s: string) {
  //   if (s.length === 42) {
  //     this.uint32(parseInt(s.substring(2, 10)))
  //     this.uint32(parseInt(s.substring(10, 18)))
  //     this.uint32(parseInt(s.substring(18, 26)))
  //     this.uint32(parseInt(s.substring(26, 34)))
  //     this.uint32(parseInt(s.substring(34, 42)))
  //   }
  // }

  // not compact, but fast
  address(s: string) {
    this.ensurePlace(40)
    if (s.length !== 42) s = `0x${s.substring(2).padStart(40, '0')}`
    const { read, written } = textEncoder.encodeInto(
      s.substring(2),
      this.data.subarray(this.position, this.position + 40),
    )
    if (read !== 40 || written !== 40)
      console.error(
        `Address serialization error: ${read} symbols were read instead of 40`,
      )
    this.position += written
  }
}

export class BinReadStream {
  data: Uint8Array
  position = 0

  constructor(data: Uint8Array) {
    this.data = data
  }

  restBytes(): number {
    return this.data.byteLength - this.position
  }

  ensurePlace(bytes: number) {
    if (this.position + bytes <= this.data.byteLength) return
    throw new Error('Out of stream')
  }

  uint8(): number {
    this.ensurePlace(1)
    return this.data[this.position++] as number
  }

  uint16(): number {
    this.ensurePlace(2)
    const low = this.data[this.position++] as number
    const high = this.data[this.position++] as number
    return low + 256 * high
  }

  uint24(): number {
    this.ensurePlace(3)
    const byte0 = this.data[this.position++] as number
    const byte1 = this.data[this.position++] as number
    const byte2 = this.data[this.position++] as number
    return byte0 + 256 * (byte1 + 256 * byte2)
  }

  int24(): number {
    return this.uint24() - INT24_SHIFT
  }

  uint32(): number {
    this.ensurePlace(4)
    const byte0 = this.data[this.position++] as number
    const byte1 = this.data[this.position++] as number
    const byte2 = this.data[this.position++] as number
    const byte3 = this.data[this.position++] as number
    return byte0 + 256 * (byte1 + 256 * (byte2 + 256 * byte3))
  }

  float64(): number {
    this.ensurePlace(8)
    floatArrayAsUint8.set(this.data.subarray(this.position, this.position + 8))
    this.position += 8
    return floatArray[0] as number
  }

  bigUInt(): bigint {
    const len = this.uint8()
    this.ensurePlace(len)
    let res = 0n
    for (let i = len - 1; i >= 0; --i) {
      res <<= 8n
      res += BigInt(this.data[this.position + i] as number)
    }
    this.position += len
    return res
  }

  bigInt(): bigint {
    const lenOrig = this.uint8()
    const len = lenOrig & 127
    this.ensurePlace(len)
    let res = 0n
    for (let i = len - 1; i >= 0; --i) {
      res <<= 8n
      res += BigInt(this.data[this.position + i] as number)
    }
    this.position += len
    return len === lenOrig ? res : -res
  }

  str16UTF8(): string {
    const len = this.uint16()
    this.ensurePlace(len)
    this.position += len
    return textDecoder.decode(
      this.data.subarray(this.position - len, this.position),
    )
  }

  str16UTF16(): string {
    const len = this.uint16()
    this.ensurePlace(len)
    const charCodes: number[] = new Array(len)
    for (let i = 0; i < len; ++i) {
      const low = this.data[this.position++] as number
      const high = this.data[this.position++] as number
      charCodes[i] = low + 256 * high
    }
    return String.fromCharCode(...charCodes)
  }

  str16(): string {
    return this.str16UTF8()
  }

  address(): Address {
    this.ensurePlace(40)
    this.position += 40
    return `0x${textDecoder.decode(
      this.data.subarray(this.position - 40, this.position),
    )}`
  }
}
