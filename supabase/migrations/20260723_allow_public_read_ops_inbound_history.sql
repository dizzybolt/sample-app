-- Sample App에 인증 기능이 도입되기 전까지 입고이력을 익명으로 조회하기 위한 정책입니다.
-- INSERT/UPDATE/DELETE 권한은 부여하지 않습니다.

alter table public.ops_inbound_history enable row level security;

grant select on table public.ops_inbound_history to anon, authenticated;

drop policy if exists "ops_inbound_history_public_read"
    on public.ops_inbound_history;

create policy "ops_inbound_history_public_read"
    on public.ops_inbound_history
    for select
    to anon, authenticated
    using (true);
