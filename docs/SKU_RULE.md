# SKU Rule

## Model Name Rule

모델명 = 브랜드코드 + 카테고리코드 + 일련번호 3자리 + 연도코드 + 시즌코드

Example:

```txt
B04SH101M2

구조:

B04 = 브랜드코드
SH = 카테고리코드
101 = 일련번호
M = 연도코드
2 = 시즌코드
SKU Rule

SKU = 모델명_색상코드_사이즈

Example:

B04SH101M2_02_095
Current Policy

현재 단계에서는 SKU를 실제 저장하지 않는다.

현재 상품 마스터의 목적은:

기존 모델명 일괄 등록
신규 모델명 자동 생성
모델명 중복 방지
추후 재고관리 앱과 쇼핑몰 등록상품 앱의 기준 데이터 준비

SKU 저장과 재고 수량 연결은 재고관리 앱 개발 단계에서 진행한다.

Code Tables

모델명 자동 생성용 코드:

brand_codes
category_codes
year_codes
season_codes

기존 샘플관리 설정 재사용:

color_codes
size_groups
Existing Model Upload

기존 사용 모델명은 상품 마스터 페이지에서 엑셀로 일괄 등록한다.

필수 헤더:

모델명

예시:

B04SH101M2
B04SH102M2
B04PT001M2