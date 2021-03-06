const Node = require('../base')
const Block = require('@ipld/block')

const mkcall = (path, start, end) => {
  let target = 'data/' + path
  return { info: { method: 'read', args: { start, end } }, target, proxy: true }
}

const _type = 'IPLD/Experimental/FixedChunker/0'

class FixedChunker extends Node {
  get _type () {
    return _type
  }
  read (args) {
    let start = args.start || 0
    let end = args.end || this.data.length
    let firstIndex = Math.floor(start / this.data.chunkSize)
    let lastIndex = Math.floor(end / this.data.chunkSize)
    let firstStart = start - (firstIndex * this.data.chunkSize)
    let reads = []
    if (firstIndex === lastIndex) {
      let firstEnd = end - (firstIndex * this.data.chunkSize)
      return { call: mkcall(firstIndex, firstStart, firstEnd) }
    } else {
      reads.push(mkcall(firstIndex, firstStart))
    }
    let i = firstIndex + 1
    while (i < lastIndex) {
      reads.push(mkcall(i))
      i++
    }
    reads.push(mkcall(i, 0, end - (i * this.data.chunkSize)))
    return { calls: reads }
  }
  length (args) {
    return { result: this.data.length }
  }
}
FixedChunker.create = async function * (source, chunkSize = 1024, codec = 'dag-json', createList = null) {
  let length
  if (Buffer.isBuffer(source)) {
    length = source.length
    let i = 0
    let cids = []
    while (i < source.length) {
      let block = Block.encoder(source.slice(i, i + chunkSize), 'raw')
      cids.push(block.cid())
      yield block
      i += chunkSize
    }
    let data = await Promise.all(cids)
    if (createList) {
      let root
      for await (let block of createList(data)) {
        yield block
        root = block
      }
      data = await root.cid()
    }
    yield Block.encoder({ data, length, chunkSize, _type }, codec)
  }
}
FixedChunker._type = _type

module.exports = FixedChunker
