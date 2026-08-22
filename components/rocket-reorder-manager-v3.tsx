'use client'

import * as XLSX from 'xlsx'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Download, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPagination } from '@/components/list-pagination'
import { createClient } from '@/lib/supabase/client'
import { fetchProductImageMap, normalizeModelName, resolveProductImage } from '@/lib/product-images'

const PAGE_SIZE = 1000
const MODEL_PAGE_SIZE = 30
const ROCKET_SHOP = '쿠팡로켓'

type SalesRow = { order_date: string; sku: string; qty: number }
type StockRow = { snapshot_date: string; sku: string; qty: number }
type SkuSummary = { sku:string; model:string; color:string; size:string; shippedQty:number; dailyAvg:number; stockQty:number; stockDays:number|null; targetQty:number; reorderQty:number }
type ModelSummary = { model:string; shippedQty:number; dailyAvg:number; stockQty:number; stockDays:number|null; targetQty:number; reorderQty:number; imageUrl:string|null; skuRows:SkuSummary[] }

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function getToday(){ return toDateString(new Date()) }
function getDaysAgo(days:number){ const d=new Date(); d.setDate(d.getDate()-Math.max(0,days-1)); return toDateString(d) }
function dayCount(start:string,end:string){ const a=new Date(`${start}T00:00:00`).getTime(); const b=new Date(`${end}T00:00:00`).getTime(); return Math.max(1,Math.floor((b-a)/86400000)+1) }

function normalizeSku(value?:string|null){
  const parts=String(value||'').trim().toUpperCase().split('_')
  if(parts.length>=3){
    const i=parts.length-1
    if(parts[i]==='FREE'||parts[i]==='FF') parts[i]='F'
  }
  return parts.join('_')
}
function skuParts(sku:string){ const p=normalizeSku(sku).split('_'); return { model:p[0]||'-', color:p[1]||'-', size:p.slice(2).join('_')||'-' } }
function fmt(v:number){ return Math.round(v||0).toLocaleString('ko-KR') }
function errorText(error:unknown){
  if(error instanceof Error) return error.message
  if(error&&typeof error==='object'){
    const e=error as {message?:string;details?:string;hint?:string;code?:string}
    return [e.message,e.details,e.hint,e.code].filter(Boolean).join(' / ')
  }
  return String(error||'알 수 없는 오류')
}

export function RocketReorderManagerV3(){
  const supabase=useMemo(()=>createClient(),[])
  const [startDate,setStartDate]=useState(()=>getDaysAgo(30))
  const [endDate,setEndDate]=useState(()=>getToday())
  const [targetSalesDays,setTargetSalesDays]=useState(120)
  const [sales,setSales]=useState<SalesRow[]>([])
  const [stock,setStock]=useState<StockRow[]>([])
  const [stockDate,setStockDate]=useState('')
  const [images,setImages]=useState<Record<string,string>>({})
  const [keyword,setKeyword]=useState('')
  const [onlyReorder,setOnlyReorder]=useState(true)
  const [expanded,setExpanded]=useState('')
  const [page,setPage]=useState(1)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  async function fetchSales(){
    const rows:SalesRow[]=[]
    for(let from=0;;from+=PAGE_SIZE){
      const result=await supabase.from('ops_sales_daily_all').select('order_date,sku,qty').eq('shop',ROCKET_SHOP).gte('order_date',startDate).lte('order_date',endDate).order('order_date',{ascending:true}).range(from,from+PAGE_SIZE-1)
      if(result.error) throw new Error(`로켓 출고 조회 실패: ${errorText(result.error)}`)
      if(!result.data?.length) break
      rows.push(...(result.data as SalesRow[]))
      if(result.data.length<PAGE_SIZE) break
    }
    return rows
  }

  async function fetchStock(){
    const latest=await supabase.from('ops_stock_snapshot').select('snapshot_date').order('snapshot_date',{ascending:false}).limit(1)
    if(latest.error) throw new Error(`최신 재고일 조회 실패: ${errorText(latest.error)}`)
    const date=String(latest.data?.[0]?.snapshot_date||'').slice(0,10)
    if(!date) return {date:'',rows:[] as StockRow[]}
    const rows:StockRow[]=[]
    for(let from=0;;from+=PAGE_SIZE){
      const result=await supabase.from('ops_stock_snapshot').select('snapshot_date,sku,qty').eq('snapshot_date',date).range(from,from+PAGE_SIZE-1)
      if(result.error) throw new Error(`최신 재고 조회 실패: ${errorText(result.error)}`)
      if(!result.data?.length) break
      rows.push(...(result.data as StockRow[]))
      if(result.data.length<PAGE_SIZE) break
    }
    return {date,rows}
  }

  async function loadImages(rows:SalesRow[]){
    try{
      const targets=Array.from(new Set(rows.map(r=>normalizeModelName(skuParts(r.sku).model)).filter(Boolean))).map(modelName=>({modelName}))
      const next:Record<string,string>={}
      for(let i=0;i<targets.length;i+=100){
        const chunk=targets.slice(i,i+100)
        const map=await fetchProductImageMap(supabase,chunk,{modelOnly:true})
        chunk.forEach(({modelName})=>{ const url=resolveProductImage(map,{modelName}); if(url) next[modelName]=url })
      }
      setImages(next)
    }catch(e){ console.error('Rocket reorder image load failed',e); setImages({}) }
  }

  async function loadData(){
    if(!startDate||!endDate||startDate>endDate){ setError('조회 기간을 확인해주세요.'); return }
    setLoading(true); setError('')
    try{
      const [s,st]=await Promise.all([fetchSales(),fetchStock()])
      setSales(s); setStock(st.rows); setStockDate(st.date); setExpanded(''); setPage(1)
      void loadImages(s)
    }catch(e){ setSales([]); setStock([]); setStockDate(''); setError(errorText(e)) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ void loadData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ },[])

  const analysisDays=useMemo(()=>dayCount(startDate,endDate),[startDate,endDate])
  const safeTargetSalesDays=Math.max(1,Number(targetSalesDays)||1)

  const models=useMemo(()=>{
    const sm=new Map<string,number>(); const stm=new Map<string,number>()
    sales.forEach(r=>{ const sku=normalizeSku(r.sku); if(sku) sm.set(sku,(sm.get(sku)||0)+Number(r.qty||0)) })
    stock.forEach(r=>{ const sku=normalizeSku(r.sku); if(sku) stm.set(sku,(stm.get(sku)||0)+Number(r.qty||0)) })
    const mm=new Map<string,ModelSummary>()
    sm.forEach((shippedQty,sku)=>{
      const p=skuParts(sku); const model=normalizeModelName(p.model)||p.model; const stockQty=stm.get(sku)||0
      const dailyAvg=shippedQty/analysisDays; const targetQty=Math.ceil(dailyAvg*safeTargetSalesDays); const reorderQty=Math.max(0,targetQty-stockQty)
      const row:SkuSummary={sku,model,color:p.color,size:p.size,shippedQty,dailyAvg,stockQty,stockDays:dailyAvg>0?stockQty/dailyAvg:null,targetQty,reorderQty}
      const cur=mm.get(model)||{model,shippedQty:0,dailyAvg:0,stockQty:0,stockDays:null,targetQty:0,reorderQty:0,imageUrl:images[model]||null,skuRows:[]}
      cur.shippedQty+=shippedQty; cur.stockQty+=stockQty; cur.targetQty+=targetQty; cur.reorderQty+=reorderQty; cur.skuRows.push(row); cur.imageUrl=images[model]||cur.imageUrl
      mm.set(model,cur)
    })
    return Array.from(mm.values()).map(m=>{ const dailyAvg=m.shippedQty/analysisDays; return {...m,dailyAvg,stockDays:dailyAvg>0?m.stockQty/dailyAvg:null,skuRows:m.skuRows.sort((a,b)=>b.reorderQty-a.reorderQty||b.shippedQty-a.shippedQty)} }).sort((a,b)=>b.reorderQty-a.reorderQty||b.shippedQty-a.shippedQty)
  },[analysisDays,images,safeTargetSalesDays,sales,stock])

  const filtered=useMemo(()=>{ const k=keyword.trim().toUpperCase(); return models.filter(m=>(!onlyReorder||m.reorderQty>0)&&(!k||m.model.includes(k)||m.skuRows.some(s=>s.sku.includes(k)))) },[keyword,models,onlyReorder])
  const totalPages=Math.max(1,Math.ceil(filtered.length/MODEL_PAGE_SIZE))
  const paged=filtered.slice((page-1)*MODEL_PAGE_SIZE,page*MODEL_PAGE_SIZE)
  useEffect(()=>{ if(page>totalPages)setPage(totalPages) },[page,totalPages])
  const totals=useMemo(()=>({models:models.length,shipped:models.reduce((a,b)=>a+b.shippedQty,0),stock:models.reduce((a,b)=>a+b.stockQty,0),reorder:models.reduce((a,b)=>a+b.reorderQty,0)}),[models])

  function preset(days:number){ setStartDate(getDaysAgo(days)); setEndDate(getToday()); setPage(1) }
  function exportExcel(){
    const rows=filtered.flatMap(m=>m.skuRows.map(s=>({모델명:m.model,SKU:s.sku,컬러:s.color,사이즈:s.size,조회시작일:startDate,조회종료일:endDate,조회일수:analysisDays,쿠팡로켓출고수량:s.shippedQty,일평균출고:Number(s.dailyAvg.toFixed(2)),최신재고기준일:stockDate,현재고:s.stockQty,재고일수:s.stockDays==null?'':Number(s.stockDays.toFixed(1)),목표판매일수:safeTargetSalesDays,목표재고:s.targetQty,추천발주수량:s.reorderQty})))
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'쿠팡로켓 발주추천'); XLSX.writeFile(wb,`쿠팡로켓_발주추천_${startDate}_${endDate}.xlsx`)
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm"><span className="text-gray-500">시작일</span><Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
          <label className="space-y-1 text-sm"><span className="text-gray-500">종료일</span><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
          <div className="flex flex-wrap gap-2">{[7,14,21,30].map(d=><Button key={d} type="button" variant="outline" size="sm" onClick={()=>preset(d)}>최근 {d}일</Button>)}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm"><span className="text-gray-500">목표 판매일수</span><div className="flex items-center gap-2"><Input type="number" min={1} step={1} value={targetSalesDays} onChange={e=>setTargetSalesDays(Math.max(1,Number(e.target.value)||1))} className="w-28 text-right"/><span className="text-sm text-gray-500">일</span></div></label>
          <Button type="button" onClick={()=>void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>조회</Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">판매 기준: {ROCKET_SHOP} · 조회 {analysisDays}일 · 목표 판매 {safeTargetSalesDays}일 · 재고 기준: {stockDate||'-'}</p>
      {error&&<p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['대상 모델',`${fmt(totals.models)}개`],['로켓 출고수량',`${fmt(totals.shipped)}개`],['최신 현재고',`${fmt(totals.stock)}개`],['추천 발주수량',`${fmt(totals.reorder)}개`]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">{l}</p><p className="mt-2 text-2xl font-bold text-gray-900">{v}</p></div>)}</section>

    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-1 flex-wrap items-center gap-3"><div className="relative min-w-[240px] flex-1 lg:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><Input value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1)}} placeholder="모델명 또는 SKU 검색" className="pl-9"/></div><label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={onlyReorder} onChange={e=>{setOnlyReorder(e.target.checked);setPage(1)}}/>발주 필요만 보기</label></div><Button type="button" variant="outline" onClick={exportExcel} disabled={!filtered.length}><Download className="mr-2 h-4 w-4"/>Excel 다운로드</Button></div>
      <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-gray-50 text-gray-500"><tr><th className="px-4 py-3 text-left">모델</th><th className="px-3 py-3 text-right">로켓출고</th><th className="px-3 py-3 text-right">일평균</th><th className="px-3 py-3 text-right">현재고</th><th className="px-3 py-3 text-right">재고일수</th><th className="px-3 py-3 text-right">목표재고</th><th className="px-3 py-3 text-right">추천발주</th><th className="w-12 px-3 py-3"/></tr></thead><tbody>
        {paged.map(m=>{const open=expanded===m.model;return <Fragment key={m.model}><tr className="border-t hover:bg-gray-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-14 w-14 overflow-hidden rounded-lg border bg-gray-50">{m.imageUrl?<img src={m.imageUrl} alt={m.model} className="h-full w-full object-cover" loading="lazy"/>:null}</div><div><p className="font-semibold text-gray-900">{m.model}</p><p className="text-xs text-gray-500">SKU {m.skuRows.length}개</p></div></div></td><td className="px-3 py-3 text-right">{fmt(m.shippedQty)}</td><td className="px-3 py-3 text-right">{m.dailyAvg.toFixed(1)}</td><td className="px-3 py-3 text-right">{fmt(m.stockQty)}</td><td className="px-3 py-3 text-right">{m.stockDays==null?'-':`${m.stockDays.toFixed(1)}일`}</td><td className="px-3 py-3 text-right">{fmt(m.targetQty)}</td><td className="px-3 py-3 text-right font-semibold text-red-600">{fmt(m.reorderQty)}</td><td className="px-3 py-3 text-center"><Button type="button" variant="ghost" size="icon" onClick={()=>setExpanded(open?'':m.model)}>{open?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</Button></td></tr>
          {open&&<tr className="border-t bg-gray-50/60"><td colSpan={8} className="px-5 py-4"><div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[920px] w-full text-xs"><thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-left">색상</th><th className="px-3 py-2 text-left">사이즈</th><th className="px-3 py-2 text-right">로켓출고</th><th className="px-3 py-2 text-right">일평균</th><th className="px-3 py-2 text-right">현재고</th><th className="px-3 py-2 text-right">재고일수</th><th className="px-3 py-2 text-right">목표재고</th><th className="px-3 py-2 text-right">추천발주</th></tr></thead><tbody>{m.skuRows.map(s=><tr key={s.sku} className="border-t"><td className="px-3 py-2 font-medium text-gray-900">{s.sku}</td><td className="px-3 py-2">{s.color}</td><td className="px-3 py-2">{s.size}</td><td className="px-3 py-2 text-right">{fmt(s.shippedQty)}</td><td className="px-3 py-2 text-right">{s.dailyAvg.toFixed(2)}</td><td className="px-3 py-2 text-right">{fmt(s.stockQty)}</td><td className="px-3 py-2 text-right">{s.stockDays==null?'-':`${s.stockDays.toFixed(1)}일`}</td><td className="px-3 py-2 text-right">{fmt(s.targetQty)}</td><td className="px-3 py-2 text-right font-semibold text-red-600">{fmt(s.reorderQty)}</td></tr>)}</tbody></table></div></td></tr>}</Fragment>})}
        {!loading&&!paged.length&&<tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">조건에 맞는 데이터가 없습니다.</td></tr>}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t p-4"><p className="text-sm text-gray-500">{filtered.length.toLocaleString('ko-KR')}개 모델</p><ListPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading}/></div>
    </section>
  </div>
}
