# CONTENT-DEPLOY: 정적 Manifest 배포 및 운영 절차 가이드

- **작업 카드**: Issue #403 [CONTENT-DEPLOY]
- **책임 레이어**: Core (`src/core/ContentLoadService.ts`, `src/core/AppBootstrap.ts`)
- **작성일**: 2026-10-06
- **기준 규칙**: `docs/01_GAME_DESIGN_DOCUMENT.md`, `docs/07_UNIFIED_EDITOR_INTEGRITY_DESIGN.md`, `docs/09_EDITOR_RUNTIME_CONTRACT.md`

---

## 1. 개요 및 설계 철학

Dream Guardian은 브라우저 에디터에서 원격 서버로 파일을 직접 업로드하거나 배포하지 않습니다.  
운영자 또는 개발자가 승인 및 검토한 불변 JSON 게시본(`PublishedContentPack`)과 배포 메타데이터(`StaticContentManifest`)를 정적 호스팅 경로(예: `public/content/manifest.json`)에 배치하고, 런타임 게임 엔진은 읽기 전용(Read-Only)으로 이를 수신·검증하여 게임에 적용합니다.

### 핵심 원칙
1. **읽기 전용 정적 수신 (Read-Only Static Fetch)**:
   - 런타임 코드는 오직 동일 origin의 정적 manifest 및 pack 리소스만 fetch합니다.
   - 에디터 모듈의 의존성 수입(import) 및 임의 쓰기 동작을 원천 차단합니다.
2. **원자적 전체 검증 및 불변 스냅샷 (Atomic Whole-Pack Verification & Freeze)**:
   - Manifest 스키마, `manifestVersion`, `contentHash`, `rulesetId`, `rulesetHash`, `runtimeContractVersion` 및 팩 데이터의 무결성을 일괄 검증합니다.
   - 검증 통과 시 `deepFreeze`를 적용한 불변 스냅샷 객체만 세션에 주입합니다.
3. **전체 단위 안전 복귀 (Whole-Pack Fallback Policy)**:
   - 404 Not Found, 손상된 JSON, 부분 배포(Partial Deployment), 해시 변조, 캐시 불일치(Stale Cache) 발생 시 부분 데이터 혼합을 금지하고 즉시 내장 기본 콘텐츠 모드(`default_csv`) 또는 직전 정상 적용본(`previousHealthyPack`)으로 전체 복귀합니다.
4. **로컬 테스트 오버라이드 격리**:
   - IndexedDB/로컬 스토어 팩 조회는 오직 명시적인 테스트 모드(`?mode=test` 또는 `isTestMode: true`)에서만 허용되며, 일반 유저 운영 환경에서는 로컬 팩에 의한 게임 오버라이드가 차단됩니다.

---

## 2. 배포 산출물 구조 및 스키마

### 2.1 디렉터리 레이아웃
정적 배포 시 추천되는 정적 호스팅 경로:
```text
public/content/
├── manifest.json              # 활성 정적 배포 Manifest (SSOT)
├── ch1-pack-v1.json           # 컴파일된 챕터 1 불변 게시본
├── ch2-pack-v1.json           # 컴파일된 챕터 2 불변 게시본
└── history/                   # 이전 정상 배포본 백업 아카이브
    └── manifest-20261006.json
```

### 2.2 Manifest 스키마 (`StaticContentManifest`)
```json
{
  "kind": "dream-guardian-static-manifest",
  "manifestVersion": 1,
  "contentHash": "5a4f7e2d9c1b...",
  "rulesetId": "dg-ruleset-v2-standard",
  "rulesetHash": "4e72a81...",
  "runtimeContractVersion": "2.0.0",
  "packPath": "content/ch1-pack-v1.json",
  "stages": ["ch1"],
  "metadata": {
    "title": "Ch.1 포겟 정식 릴리스 팩",
    "version": "1.0.0",
    "deployedAt": "2026-10-06T12:00:00.000Z",
    "description": "안정화된 Phase A 별 노트 및 Phase B 보스 패턴 포함"
  }
}
```

### 2.3 필드 정의 및 제약 조건
| 필드명 | 타입 | 필수 여부 | 검증 및 제약 사항 |
|---|---|:---:|---|
| `kind` | `string` | 선택 | 기본값 `'dream-guardian-static-manifest'` |
| `manifestVersion` | `number` | **필수** | 반드시 `1` (상수 `STATIC_MANIFEST_VERSION`) |
| `contentHash` | `string` | **필수** | 64자리 SHA-256 Hex 문자열, 팩의 실제 실행 페이로드 해시와 일치해야 함 |
| `rulesetId` | `string` | **필수** | 런타임 지원 ruleset ID 목록에 포함 (`SUPPORTED_RULESET_IDS`) |
| `rulesetHash` | `string` | **필수** | 64자리 SHA-256 Hex 문자열, 런타임 V2 프로필 해시와 일치해야 함 |
| `runtimeContractVersion` | `string` | **필수** | 런타임 지원 계약 버전 (`SUPPORTED_RUNTIME_VERSIONS`, 예: `'2.0.0'`) |
| `packPath` | `string` | 조건부 | 팩 JSON 상대 경로 (인라인 `pack` 객체가 없을 경우 필수) |
| `pack` | `object` | 조건부 | 인라인 포함된 `PublishedContentPack` (생략 시 `packPath`로 fetch) |
| `stages` | `string[]` | 선택 | 배포 팩이 충족해야 하는 스테이지 ID 바인딩 목록 (예: `['ch1']`) |

---

## 3. 정적 배포 표준 운영 절차 (Static Deployment Workflow)

### Step 1: 에디터에서 불변 팩 컴파일 및 추출
1. 브라우저 에디터 또는 빌드 도구를 통해 안무 및 보스 패턴을 컴파일합니다.
2. `ContentCompiler`가 생성한 `PublishedContentPack` JSON 파일을 내보냅니다.
3. 생성된 팩의 `contentHash`, `rulesetHash`, `runtimeContractVersion`을 확인합니다.

### Step 2: 배포 파일 저장소 배치
1. 팩 JSON 파일을 버전이 명시된 파일명(예: `public/content/ch1-pack-20261006.json`)으로 배치합니다.
2. `public/content/manifest.json` 파일을 작성하여 대상 팩의 `contentHash`, `rulesetHash`, `packPath`를 등록합니다.
3. Git 저장소에 커밋 후 정적 웹 호스팅 환경(CDN/GitHub Pages/S3 등)에 배포합니다.

### Step 3: 무결성 검증
1. 배포 후 브라우저 개발자 도구 네트워크 탭에서 `content/manifest.json` 및 `content/pack.json`이 200 OK로 반환되는지 확인합니다.
2. 콘솔에서 `ContentLoadService`가 `[DG] Static manifest loading success` 상태로 전환되는지 확인합니다.

---

## 4. 예외 방어 및 Fallback 정책

| 장애 상황 | 감지 기제 | 처리 방식 | 최종 동작 모드 |
|---|---|---|---|
| **404 Not Found** (Manifest 부재) | `res.status === 404` | whole-pack fallback | 내장 기본 모드(`default_csv`) 복귀 |
| **네트워크 오류 / 오프라인** | fetch reject / 타임아웃 | 직전 정상본 조회 후 fallback | `previousHealthyPack` 또는 `default_csv` |
| **손상된 JSON** (SyntaxError) | JSON 파싱 예외 포착 | 즉시 로드 중단, fallback | `default_csv` |
| **부분 배포 (Partial Deployment)** | manifest는 있으나 pack 404 또는 stage 누락 | 불완전 데이터 폐기, whole-pack fallback | `default_csv` (부분 혼합 일체 금지) |
| **캐시 불일치 (Stale Cache)** | manifest와 pack의 `contentHash` 불일치 | 변조/캐시 지연으로 판정, fallback | 직전 정상본 유지 또는 `default_csv` |
| **페이로드 변조 (Tamper)** | 팩 내부 contentHash 재계산 불일치 | 보안 위협으로 차단, fallback | `default_csv` |
| **일반 모드 로컬 오버라이드 시도** | `isTestMode === false` 상태의 스토어 요청 | `test-override-forbidden` 차단 | 정적 팩 또는 `default_csv` 유지 |

---

## 5. 오프라인 보존 및 직전 정상본 정책 (Offline Preservation Policy)

1. **메모리 직전 정상본 보존**:
   - `ContentLoadService`는 정적 manifest 로드에 성공한 최초/최신의 팩을 `_previousHealthyPack` 메모리 레지스터에 보관합니다.
2. **네트워크 장애 대응**:
   - 신규 버전 배포 중 네트워크 순단이나 임시 5xx 에러가 발생한 경우, 깨진 데이터를 게임에 주입하지 않고 `_previousHealthyPack`을 복구용 fallback 팩으로 반환합니다.
3. **PWA / Service Worker 정적 캐싱 연계**:
   - 오프라인 환경에서도 `content/manifest.json` 및 정적 팩 파일이 캐시되어 있으면 완벽히 동일한 hash로 게임이 실행됩니다.

---

## 6. 롤백 표준 절차 (Rollback Operations)

배포된 콘텐츠에서 기획 오류나 버그가 발견되었을 경우, 긴급 롤백은 다음과 같이 **단일 포인터 전환**으로 수행합니다.

### 긴급 롤백 절차
1. `public/content/manifest.json` 파일의 `contentHash`와 `packPath`를 이전 안정 버전(예: `history/ch1-pack-v1-stable.json`)으로 수정합니다.
2. CDN 캐시를 무효화(Purge)하거나 `manifest.json`을 배포합니다.
3. 클라이언트는 별도의 코드 변경 없이 다음 페이지 로드 또는 스테이지 재시작 시점에 이전 정상본으로 자동 롤백됩니다.
4. 만약 긴급히 모든 커스텀 팩을 비활성화해야 하는 경우:
   - `manifest.json`을 제거(404 유도)하거나 `manifestVersion: 0` 등 무효화 처리를 하면, 클라이언트는 즉시 안전하게 100% 내장 기본 모드(`default_csv`)로 전체 복귀합니다.
