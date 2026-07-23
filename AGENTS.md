## External services

### Supabase

- Supabase 관련 코드를 수정하기 전에 기존 클라이언트, 타입 및
  `supabase/migrations`를 확인한다.
- 실제 테이블 구조와 저장소의 정의가 다르면 임의로 판단하지 말고 차이를 보고한다.
- `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 코드에 노출하지 않는다.
- DB 변경은 가능하면 재실행 가능한 SQL migration으로 작성한다.
- 사용자의 승인 없이 운영 데이터의 삭제, 초기화 또는 대량 수정을 실행하지 않는다.

### Vercel

- 기능 브랜치와 Pull Request를 통해 Vercel Preview 배포를 생성한다.
- Preview 빌드 결과를 확인한 후 작업 완료를 보고한다.
- 사용자의 승인 없이 Production 환경변수나 배포 설정을 변경하지 않는다.
- 사용자의 승인 없이 main 병합 또는 Production 배포를 실행하지 않는다.

### Git workflow

- main에 직접 작업하지 않는다.
- 기능별 feature 브랜치를 사용한다.
- 충돌이 발생하면 임의로 해결하지 말고 원인과 선택지를 먼저 보고한다.
- lint, typecheck, production build를 통과한 뒤 PR을 생성한다.