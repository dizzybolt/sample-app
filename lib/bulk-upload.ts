export type BulkProgress = {
  total: number
  processed: number
  success: number
  fail: number
  percent: number
}

type BatchUpsertParams<T> = {
  supabase: any
  tableName: string
  rows: T[]
  onConflict?: string
  chunkSize?: number
  onProgress?: (progress: BulkProgress) => void
}

export async function batchUpsert<T>({
  supabase,
  tableName,
  rows,
  onConflict,
  chunkSize = 500,
  onProgress,
}: BatchUpsertParams<T>) {
  let success = 0
  let fail = 0
  const errors: string[] = []
  const total = rows.length

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    const { error } = onConflict
      ? await supabase.from(tableName).upsert(chunk, { onConflict })
      : await supabase.from(tableName).upsert(chunk)

    if (error) {
      fail += chunk.length
      errors.push(error.message)
    } else {
      success += chunk.length
    }

    onProgress?.({
      total,
      processed: Math.min(i + chunk.length, total),
      success,
      fail,
      percent: total
        ? Math.round((Math.min(i + chunk.length, total) / total) * 100)
        : 0,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return {
    total,
    success,
    fail,
    errors,
  }
}