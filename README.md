# 🕵️‍♂️ 명탐정 방탈출 (Detective Escape Room)

100인 동시 참여형 웹 기반 방탈출 수사 추리 게임 플랫폼입니다.
Next.js 14 App Router, Tailwind CSS, Supabase(PostgreSQL), Vercel Serverless로 구동됩니다.

---

## ⚡ Supabase 3분 연동 가이드 (Single Source of Truth)

Vercel 서버리스 람다의 다중 인스턴스 환경에서 발생할 수 있는 후기 개수 깜빡임(Flickering)과 브라우저 좀비 캐시를 방지하기 위해 **Supabase DB(PostgreSQL 15)** 연동이 구현되어 있습니다.

### 1단계: Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에 로그인 후 **New Project**를 생성합니다.
2. Database 비밀번호를 설정하고 프로젝트 생성을 완료합니다.

### 2단계: SQL 테이블 및 시드 데이터 실행 (1클릭)
1. Supabase 대시보드 좌측 메뉴에서 **SQL Editor**로 이동합니다.
2. 프로젝트의 `supabase/schema.sql` 파일 내용을 복사하여 붙여넣고 **Run**을 누릅니다. (테이블, 인덱스, RLS, Realtime 자동 설정)
3. 프로젝트의 `supabase/seed.sql` 파일 내용을 복사하여 붙여넣고 **Run**을 누릅니다. (100인 수사관 PIN 및 초기 후기 자동 등록)

### 3단계: Vercel 환경변수 등록
Vercel 프로젝트 대시보드 > **Settings** > **Environment Variables**에 아래 2개 항목을 등록합니다:

| 환경변수 이름 | Supabase 대시보드 위치 | 설명 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings** > **API** > Project URL | Supabase 엔드포인트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings** > **API** > `service_role` (secret) | RLS 권한을 갖는 보안 키 |

> **안내**: Supabase 환경변수를 등록하기 전에도 앱은 기존 인메모리/Blob 스토리지 방식으로 자동 폴백(Graceful Fallback)되어 정상 동작합니다.

---

## 🛠️ 로컬 개발 환경 실행

```bash
# 패키지 설치
npm install

# 로컬 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하여 테스트할 수 있습니다.
- 참가자 플레이: `http://localhost:3000/` (암호 입력)
- 관리자 대시보드: `http://localhost:3000/admin` (비밀번호: `2026`)