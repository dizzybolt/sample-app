# OPS 데이터 갱신일 페이지별 표시 적용

이 폴더의 `app`, `components` 폴더를 Sample App 프로젝트 루트에 그대로
덮어씁니다.

## 페이지별 표시 항목

| 페이지 | 표시되는 OPS 갱신일 |
| --- | --- |
| 주문통계 | 출고, 클레임 |
| 클레임 통계 | 클레임 |
| 재고관리 | 재고 |
| 사은품 출고내역 | 출고 |
| 입고이력 | 입고 |
| 발주추천 | 입고, 출고, 재고 |
| 로켓SKU관리 | 이미지 |
| 이미지관리 | 이미지 |

## 로그 선택 규칙

- 출고: `sales_daily` 우선, 없으면 `sales_daily_all`
- 클레임: `claim_daily` 우선, 없으면 `claim_daily_all`
- 재고: `stock_snapshot`
- 입고: `inbound_history`
- 이미지: `images`

표시 시각은 `ops_sync_logs.finished_at`을 한국 시간으로 변환한 값입니다.

## 적용 후 확인

```powershell
npm run build
```

로컬 `.env.local`에 Supabase URL과 anon key가 있어야 전체 빌드가 완료됩니다.
