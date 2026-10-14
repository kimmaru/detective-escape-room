-- ==============================================================================
-- 명탐정 방탈출 (Detective Escape Room) - Supabase Database Schema
-- Single Source of Truth (SSOT) Architecture
-- ==============================================================================

-- 1. escape_sessions: 100인 참가자 세션 관리 테이블
CREATE TABLE IF NOT EXISTS public.escape_sessions (
    pin VARCHAR(20) PRIMARY KEY,
    nickname VARCHAR(100) NOT NULL,
    current_room INT NOT NULL DEFAULT 1,
    started_at BIGINT,
    room_entered_at BIGINT,
    unlocked_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_hint_unlocked_at BIGINT,
    is_cleared BOOLEAN NOT NULL DEFAULT false,
    cleared_at BIGINT,
    total_time_seconds INT NOT NULL DEFAULT 0,
    total_hints_used INT NOT NULL DEFAULT 0,
    last_active_at BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ready',
    has_reviewed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. escape_reviews: 수사 후기 및 인증 사진 테이블 (1인 1후기)
CREATE TABLE IF NOT EXISTS public.escape_reviews (
    id BIGSERIAL PRIMARY KEY,
    pin VARCHAR(20) NOT NULL UNIQUE REFERENCES public.escape_sessions(pin) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    photo_url TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL,
    inserted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. 빠른 조회를 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_escape_sessions_status ON public.escape_sessions(status);
CREATE INDEX IF NOT EXISTS idx_escape_sessions_cleared ON public.escape_sessions(is_cleared);
CREATE INDEX IF NOT EXISTS idx_escape_reviews_created_at ON public.escape_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escape_reviews_hidden ON public.escape_reviews(is_hidden);

-- 4. 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_escape_sessions_updated_at ON public.escape_sessions;
CREATE TRIGGER tr_escape_sessions_updated_at
BEFORE UPDATE ON public.escape_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Row Level Security (RLS) 설정
ALTER TABLE public.escape_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escape_reviews ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (재실행 가능하도록)
DROP POLICY IF EXISTS "Public read reviews non hidden" ON public.escape_reviews;
DROP POLICY IF EXISTS "Service role full access reviews" ON public.escape_reviews;
DROP POLICY IF EXISTS "Service role full access sessions" ON public.escape_sessions;
DROP POLICY IF EXISTS "Public read sessions" ON public.escape_sessions;

-- 공개 읽기: 숨겨지지 않은 후기만 누구나 읽기 가능
CREATE POLICY "Public read reviews non hidden"
ON public.escape_reviews FOR SELECT
USING (is_hidden = false);

-- 서비스 롤 (Vercel Serverless 백엔드): 모든 권한
CREATE POLICY "Service role full access reviews"
ON public.escape_reviews FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access sessions"
ON public.escape_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 공개 세션 읽기 허용 (클라이언트 직접 Realtime 구독 시 필요)
CREATE POLICY "Public read sessions"
ON public.escape_sessions FOR SELECT
TO anon, authenticated
USING (true);

-- 6. Supabase Realtime 활성화 (게시판 및 대시보드 실시간 브로드캐스트)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escape_sessions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.escape_reviews;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
