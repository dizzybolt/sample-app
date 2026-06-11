# Status Flow

## Sample Flow
샘플입고
→ 진행
→ 등록대기
→ 발주대기
→ 입고대기
→ 입고완료

## Studio Status
- 촬영대기
- 촬영중
- 촬영완료
- 작업대기
- 작업중
- 작업완료

## Inbound Status
- 입고대기
- 부분입고
- 입고완료

## Inbound Batch Rule
- 1차 입고는 일반 입고다.
- 2차 이상은 추가입고 이력이다.
- 추가입고는 inbound_status 값으로 저장하지 않는다.
- batch_no >= 2 는 추가입고 이력용이다.
- 누적입고수량 >= 입고예정수량이면 입고완료로 본다.

## Dashboard Rule
- 입고완료 최근 수량은 최근 1행이 아니라 같은 중국품번/최근입고일 기준 총합계를 표시한다.
- 최근 카드에는 중국품번, 한국품번, 날짜, 수량 요약을 표시한다.
- 대시보드 최근 현황 패널은 탭형이다.
  - 스튜디오 현황
  - 입고 현황
  - 샘플등록 현황

## Inventory Flow

### Manual Inventory
수동 등록/수정
→ inventory 저장
→ inventory_logs 기록

### Excel Inventory Upload
엑셀 업로드
→ 창고 + SKU 기준 기존 재고 확인
→ 기존 재고 있음: 수량 변경 또는 수량 조정
→ 기존 재고 없음: 신규 등록
→ inventory_logs 기록

### Inbound to Inventory
입고상세에서 회차별 입고수량 입력
→ 재고 반영 창고 선택
→ 입고완료
→ 선택 회차 수량을 inventory에 반영
→ inventory_logs 기록
→ inbound_batches.inventory_reflected = true

### Duplicate Prevention
- 입고회차가 이미 inventory_reflected = true 이면 재고에 다시 반영하지 않는다.