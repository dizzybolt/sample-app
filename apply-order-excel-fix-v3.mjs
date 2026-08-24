import fs from 'node:fs'
import path from 'node:path'

const rel = 'components/order-sheet-client.tsx'
const file = path.join(process.cwd(), rel)

if (!fs.existsSync(file)) {
  console.error(`[ERROR] 파일을 찾을 수 없습니다: ${rel}`)
  process.exit(1)
}

let source = fs.readFileSync(file, 'utf8')
const before = source

source = source.replace(
  /\{\s*wch:\s*42\s*,\s*hidden:\s*true\s*\}/g,
  '{ wch: 42 }'
)

source = source.replace(
  /\{\s*hidden:\s*true\s*,\s*wch:\s*42\s*\}/g,
  '{ wch: 42 }'
)

fs.writeFileSync(file, source, 'utf8')

if (source === before) {
  console.log('[INFO] 변경 대상이 없었습니다. 이미 v3 형태일 수 있습니다.')
} else {
  console.log(`[OK] ${rel}`)
  console.log('[OK] Excel 생성 시 A열을 미리 숨기지 않도록 수정 완료')
}

console.log('[NEXT] XLSM 템플릿의 ImageLoader를 v3로 교체하세요.')
