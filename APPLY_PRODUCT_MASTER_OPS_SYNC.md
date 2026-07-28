# OPS 재고 기반 상품마스터 자동 생성 적용

## 1. Supabase SQL 적용

Supabase SQL Editor에서 아래 파일 전체를 실행합니다.

```text
supabase/migrations/20260728_sync_product_master_from_ops_stock.sql
```

SQL을 실행하는 즉시 현재 `ops_stock_snapshot`을 기준으로 누락된 모델과
SKU가 생성됩니다. 이후에는 `stock_snapshot` 업로드 성공 로그가 기록될
때마다 자동으로 보완됩니다.

자동 동기화가 생성하거나 갱신하는 값:

- `product_master`: 없는 모델만 `준비중` 상태로 생성
- `product_skus`: 모델 + 2자리 컬러 + 규격화 사이즈로 SKU 생성
- FREE는 `F`
- 80, 85, 90, 95는 `080`, `085`, `090`, `095`
- 그 외 사이즈는 원래 값을 유지

자동 동기화가 덮어쓰지 않는 값:

- 판매가, TAG가, 원가
- 상품상태, 성별, 사이즈그룹, 비고
- 컬러명, 바코드, 이미지 등 사용자가 보완한 정보

## 2. 앱 파일 적용

프로젝트 루트에 다음 파일을 그대로 덮어씁니다.

```text
app/products/page.tsx
components/product-master-manager.tsx
```

## 3. 확인

```powershell
npm run lint
npm run build
```

상품마스터 페이지 확인 항목:

- 상단에 OPS 재고 최근 갱신일 표시
- 한 페이지에 50개 모델 표시
- 전체 건수와 현재 표시 범위 표시
- 검색/상태/가격/보완상태 필터가 서버 조회에 적용
- SKU 수, 색상 수, OPS 현재고 표시
- 자동 생성 모델은 `정보 보완 필요`로 식별

필요한 경우 SQL Editor에서 수동 동기화할 수 있습니다.

```sql
select public.sync_product_master_from_ops_stock();
```
