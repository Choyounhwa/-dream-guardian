/**
 * EditorModalViews.ts - 피트니스 안무 에디터 모달 및 피드백 뷰 전담 렌더러 (#627)
 * 
 * 스테이지 바인딩 패널, 배포 모달, 테스트 플레이 피드백 UI 렌더링 로직을 격리하여
 * EditorLayout의 단일 책임 유지 및 코드 라인 수 1,000줄 미만 준수를 보장합니다.
 */

import { EditorState } from './EditorState.js';
import type { EditorPublishStatus, TestLaunchResult } from './EditorPublishController.js';
import type { PublishedPackSummary } from '../storage/PublishedContentStore.js';

export class EditorModalViews {
  private readonly _state: EditorState;

  constructor(state: EditorState) {
    this._state = state;
  }

  /**
   * 구간 및 스테이지 연결 패널(Stage Bindings Panel) HTML 렌더링
   */
  renderStageBindingsPanelHTML(): string {
    const bindings = this._state.getBindings();
    const sequences = this._state.getSequences();
    const coverage = this._state.getStageCoverageStatus();

    const bindingsRows = bindings
      .map((b, idx) => {
        const seq = sequences.find((s) => s.id === b.sequenceId);
        const role = b.role || seq?.kind || 'motionGuide';
        const compoundKey = `${b.chapterId}::${b.subLevelId ?? 'all'}::${b.phase}::${role}`;
        return `
          <tr class="binding-row" data-binding-index="${idx}">
            <td class="binding-key"><code>${compoundKey}</code></td>
            <td>${b.chapterId}</td>
            <td>${b.subLevelId ?? '(all)'}</td>
            <td>${b.phase}</td>
            <td>${b.sequenceId}</td>
            <td>${role}</td>
            <td>
              <button type="button" class="btn btn-sm btn-danger btn-remove-binding" data-index="${idx}">삭제</button>
            </td>
          </tr>
        `;
      })
      .join('');

    const stageCoverageRows = coverage.stages
      .map((st) => {
        const statusBadge =
          st.status === 'bound'
            ? '<span class="badge badge-success">바인딩 완료</span>'
            : st.status === 'builtin'
            ? `<span class="badge badge-info">내장 프리셋 (${st.builtinProfile})</span>`
            : st.status === 'partial'
            ? '<span class="badge badge-warning">부분 미완성 (Partial)</span>'
            : '<span class="badge badge-danger">누락 (Missing)</span>';

        return `
          <tr class="stage-row" data-chapter="${st.chapterId}">
            <td><strong>${st.chapterId.toUpperCase()}</strong></td>
            <td>${statusBadge}</td>
            <td>
              <select class="editor-select select-stage-preset" data-chapter="${st.chapterId}">
                <option value="" ${!st.builtinProfile ? 'selected' : ''}>프리셋 없음 (직접 바인딩)</option>
                <option value="${st.chapterId}-default-v2" ${st.builtinProfile === `${st.chapterId}-default-v2` ? 'selected' : ''}>${st.chapterId}-default-v2</option>
                <option value="${st.chapterId}-challenge-v2" ${st.builtinProfile === `${st.chapterId}-challenge-v2` ? 'selected' : ''}>${st.chapterId}-challenge-v2</option>
              </select>
            </td>
          </tr>
        `;
      })
      .join('');

    return `
      <div class="stage-bindings-panel" id="stage-bindings-panel">
        <div class="panel-header">
          <div class="panel-header-title">
            <h3>🔗 스테이지 구간 바인딩 & 프리셋 관리</h3>
            <span class="panel-status ${coverage.isComplete ? 'coverage-ok' : 'coverage-warn'}">
              ${coverage.isComplete ? '전체 스테이지 매핑 완료' : '일부 스테이지 미완성 / 누락'}
            </span>
          </div>
          <button id="btn-close-bindings" type="button" class="btn btn-ghost">✕ 닫기</button>
        </div>

        <!-- 미지원 잠금(Lock) 배지 및 알림 영역 -->
        <div class="lock-notices">
          <div class="lock-badge-item">
            <span class="badge-lock">🔒 미지원: Phase A 장판(Hazard) 트랙 잠금 (Locked)</span>
            <small class="lock-desc">Phase A 장판 인터랙션은 런타임 제약으로 인해 저작이 잠겨 있습니다.</small>
          </div>
          <div class="lock-badge-item">
            <span class="badge-lock">🔒 미지원: Phase B 피버 결전 장판(Hazard) 잠금 (Locked)</span>
            <small class="lock-desc">Phase B 피버 결전 장판 트랙은 저작이 잠겨 있습니다.</small>
          </div>
        </div>

        <!-- 스테이지 커버리지 현황 -->
        <div class="panel-section">
          <h4>스테이지별 커버리지 및 내장 프리셋</h4>
          <table class="bindings-table stage-table">
            <thead>
              <tr><th>스테이지</th><th>상태</th><th>내장 프리셋 설정</th></tr>
            </thead>
            <tbody>
              ${stageCoverageRows}
            </tbody>
          </table>
        </div>

        <!-- 활성 바인딩 목록 -->
        <div class="panel-section">
          <h4>활성 구간 바인딩 목록 (${bindings.length}개)</h4>
          <table class="bindings-table">
            <thead>
              <tr><th>Compound Key</th><th>Chapter</th><th>SubLevel</th><th>Phase</th><th>Sequence ID</th><th>Role</th><th>작업</th></tr>
            </thead>
            <tbody>
              ${bindingsRows}
            </tbody>
          </table>
        </div>

        <!-- 새 바인딩 추가 폼 -->
        <div class="panel-section add-binding-form">
          <h4>새 구간 바인딩 추가</h4>
          <div class="form-grid">
            <div class="form-row">
              <label for="bind-chapter">Chapter:</label>
              <select id="bind-chapter" class="editor-select">
                <option value="ch1">Chapter 1 (ch1)</option>
                <option value="ch2">Chapter 2 (ch2)</option>
                <option value="ch3">Chapter 3 (ch3)</option>
                <option value="ch4">Chapter 4 (ch4)</option>
                <option value="ch5">Chapter 5 (ch5)</option>
              </select>
            </div>
            <div class="form-row">
              <label for="bind-sublevel">SubLevel ID:</label>
              <input id="bind-sublevel" type="text" class="editor-input" placeholder="star_collect, run_question 등 (선택)" />
            </div>
            <div class="form-row">
              <label for="bind-phase">Phase:</label>
              <select id="bind-phase" class="editor-select">
                <option value="phaseA">phaseA</option>
                <option value="phaseB">phaseB</option>
              </select>
            </div>
            <div class="form-row">
              <label for="bind-seq">Sequence:</label>
              <select id="bind-seq" class="editor-select">
                ${sequences.map((s) => `<option value="${s.id}">${s.id} (${s.phase} / ${s.kind})</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <label for="bind-role">Role:</label>
              <select id="bind-role" class="editor-select">
                <option value="starNotes">starNotes</option>
                <option value="motionGuide">motionGuide</option>
                <option value="feverNotes">feverNotes</option>
                <option value="hazard">hazard</option>
              </select>
            </div>
          </div>
          <button id="btn-add-binding" type="button" class="btn btn-primary">+ 바인딩 추가</button>
        </div>
      </div>
    `.trim();
  }

  /**
   * 프로젝트 검증·게시 및 릴리즈 관리 모달(Publish & Release Modal) HTML 렌더링
   */
  renderPublishModalHTML(
    status?: EditorPublishStatus | null,
    versions: PublishedPackSummary[] = []
  ): string {
    const isDirty = status?.isFormDirty ?? false;
    const activeHash = status?.activeContentHash ?? '없음 (기본 프리셋)';
    const stagedHash = status?.stagedActivationHash ?? '예약 없음';
    const prevHealthy = status?.previousHealthyHash ?? '없음';
    const lastHash = status?.lastPublishedHash ?? '없음';
    const validation = status?.lastValidation;

    // 검증 결과 UI 블록
    let validationHTML = '';
    if (validation) {
      const statusBadge = validation.valid
        ? '<span class="badge badge-success" style="background:#10B981; color:#fff; padding:3px 8px; border-radius:4px;">✅ 검증 통과 (게시 준비 완료)</span>'
        : '<span class="badge badge-danger" style="background:#EF4444; color:#fff; padding:3px 8px; border-radius:4px;">❌ 검증 실패</span>';

      const errorList =
        validation.errors.length > 0
          ? `<ul class="publish-error-list" style="color:#EF4444; margin:8px 0; padding-left:20px;">${validation.errors.map((e) => `<li>${e}</li>`).join('')}</ul>`
          : '';

      const warnList =
        validation.warnings.length > 0
          ? `<ul class="publish-warn-list" style="color:#F59E0B; margin:8px 0; padding-left:20px;">${validation.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>`
          : '';

      const diffHTML = validation.diffSummary
        ? `
          <div class="diff-summary-box" style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:4px; margin-top:8px;">
            <div><strong>변경 요약:</strong> ${validation.diffSummary.summaryText}</div>
            <div style="margin-top:4px;"><small>산출 Content Hash: <code>${validation.contentHash || '-'}</code></small></div>
          </div>
        `
        : '';

      validationHTML = `
        <div class="panel-section validation-section" style="margin:16px 0; padding:12px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid var(--border-color, #272f4a);">
          <div style="font-weight:600; margin-bottom:6px;">검증 상태: ${statusBadge}</div>
          ${errorList}
          ${warnList}
          ${diffHTML}
        </div>
      `;
    }

    const versionRows =
      versions.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#888; padding:12px;">게시된 버전이 없습니다.</td></tr>'
        : versions
            .map((v) => {
              const isActive = v.contentHash === status?.activeContentHash;
              const isStaged = v.contentHash === status?.stagedActivationHash;
              const stateBadge = isActive
                ? '<span class="badge badge-success" style="background:#10B981; color:#fff; padding:2px 6px; border-radius:4px;">활성 (Active)</span>'
                : isStaged
                ? '<span class="badge badge-warning" style="background:#F59E0B; color:#fff; padding:2px 6px; border-radius:4px;">다음 스테이지 예약 (Staged)</span>'
                : '<span class="badge badge-secondary" style="background:#4B5563; color:#fff; padding:2px 6px; border-radius:4px;">보관됨</span>';

              const shortHash = v.contentHash.slice(0, 12);
              const dateStr = new Date(v.publishedAt).toLocaleString();

              return `
                <tr class="version-row" data-hash="${v.contentHash}">
                  <td><code>${shortHash}...</code></td>
                  <td>rev.${v.sourceRevision}</td>
                  <td>${dateStr}</td>
                  <td>${stateBadge}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-primary btn-test-version" data-hash="${v.contentHash}" title="이 버전으로 격리 테스트 플레이 실행">🎮 테스트</button>
                    <button type="button" class="btn btn-sm btn-outline btn-stage-version" data-hash="${v.contentHash}">다음 스테이지 예약</button>
                    ${isActive ? '' : `<button type="button" class="btn btn-sm btn-outline btn-rollback-version" data-hash="${v.contentHash}">롤백 예약</button>`}
                  </td>
                </tr>
              `;
            })
            .join('');

    return `
      <div class="publish-modal-panel" id="publish-modal-panel" style="display:flex; flex-direction:column; gap:14px;">
        <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px;">📦 프로젝트 검증·불변 게시 및 릴리즈 관리</h3>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-close-publish-modal">✕ 닫기</button>
        </div>

        <div class="panel-notice notice-info" style="background:rgba(40,230,255,0.1); border-left:4px solid #28E6FF; padding:10px 14px; border-radius:4px; font-size:12px;">
          ℹ️ <strong>적용 안내:</strong> 새 버전 게시 및 적용 예약은 <strong>다음 스테이지 시작 시</strong> 안전하게 활성화됩니다. 현재 실행 중인 실시간 게임 세션에는 즉시 반영되지 않습니다.
        </div>

        ${
          isDirty
            ? `<div class="panel-notice notice-warning" style="background:rgba(239,68,68,0.15); border-left:4px solid #EF4444; padding:10px 14px; border-radius:4px; font-size:12px; color:#FCA5A5;">
                ⚠️ <strong>수정 중인 미완성 폼 입력이 있습니다!</strong> 폼을 확정하거나 취소한 후 게시를 진행해 주세요.
               </div>`
            : ''
        }

        <div class="panel-section release-info-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(255,255,255,0.03); padding:12px; border-radius:6px; font-size:12px;">
          <div><strong>현재 활성 해시:</strong> <code style="color:#28E6FF;">${activeHash}</code></div>
          <div><strong>다음 스테이지 예약:</strong> <code style="color:#FFCB4D;">${stagedHash}</code></div>
          <div><strong>이전 정상본 해시:</strong> <code style="color:#A78BFA;">${prevHealthy}</code></div>
          <div><strong>최근 게시본 해시:</strong> <code>${lastHash}</code></div>
        </div>

        <div class="panel-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="btn-modal-validate" type="button" class="btn btn-outline">🔍 무결성 검증</button>
          <button id="btn-modal-publish" type="button" class="btn btn-success" ${isDirty ? 'disabled' : ''} style="background:#10B981; color:#fff;">🚀 불변 게시</button>
          <button id="btn-modal-test-play" type="button" class="btn btn-primary" style="background:#2563EB; color:#fff;" title="현재 활성 게시본으로 격리 테스트 플레이 실행">🎮 테스트 플레이</button>
          <button id="btn-modal-stage-activation" type="button" class="btn btn-primary" style="background:#6366F1; color:#fff;">✨ 다음 스테이지 적용 예약</button>
          <button id="btn-modal-rollback" type="button" class="btn btn-warning" style="background:#F59E0B; color:#fff;">↺ 이전 정상본으로 롤백 예약</button>
        </div>

        <div class="panel-section test-play-isolation-banner" style="background:rgba(37,99,235,0.08); border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:10px 14px; font-size:12px; color:#93C5FD;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>🛡️ 테스트 플레이 격리 보장 (Issue #391 계약)</strong>
            <span id="test-launch-status-badge" style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.1);">대기 중</span>
          </div>
          <div style="font-size:11px; color:#BFDBFE; margin-top:4px;">
            테스트 플레이는 검증 완료된 게시본 hash로만 실행되며, 실제 게임 전역 설정·진척도(starsMap)·하이스코어·보상 저장이 완전히 차단됩니다.
          </div>
          <div id="test-launch-feedback" class="test-launch-feedback" style="display:none; margin-top:8px;"></div>
        </div>

        ${validationHTML}

        <div class="panel-section version-history-section">
          <h4 style="margin:8px 0;">게시된 버전 이력 (${versions.length}개)</h4>
          <table class="editor-table version-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:12px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color, #272f4a); color:var(--text-muted, #8e9bb5);">
                <th style="padding:6px;">Content Hash</th>
                <th style="padding:6px;">Revision</th>
                <th style="padding:6px;">게시 일시</th>
                <th style="padding:6px;">상태</th>
                <th style="padding:6px;">동작</th>
              </tr>
            </thead>
            <tbody>
              ${versionRows}
            </tbody>
          </table>
        </div>
      </div>
    `.trim();
  }

  /**
   * 테스트 플레이 실행 결과 피드백 HTML 렌더링 (Issue #393 / EDITOR-TEST-LAUNCH)
   */
  renderTestLaunchFeedbackHTML(result: TestLaunchResult): string {
    if (result.ok && result.descriptor) {
      const isMatched = result.targetHash === result.executedHash;
      const shortTarget = result.targetHash ? result.targetHash.slice(0, 12) : '-';
      const shortExecuted = result.executedHash ? result.executedHash.slice(0, 12) : '-';
      return `
        <div class="feedback-box feedback-success" style="background:rgba(16,185,129,0.15); border:1px solid #10B981; border-radius:4px; padding:8px 12px; font-size:12px; color:#D1FAE5;">
          <div style="font-weight:700; margin-bottom:4px; color:#6EE7B7;">
            🎮 테스트 플레이가 격리 세션으로 실행되었습니다.
          </div>
          <div style="display:grid; grid-template-columns:auto 1fr; gap:2px 10px; font-family:monospace; font-size:11px;">
            <span>요청 Hash:</span><span>${shortTarget}...</span>
            <span>실행 Hash:</span><span>${shortExecuted}...</span>
            <span>해시 일치:</span><span style="color:#10B981; font-weight:bold;">${isMatched ? '✅ 일치 (Matched)' : '❌ 불일치'}</span>
            <span>BPM:</span><span>${result.descriptor.bpm}</span>
          </div>
          <div style="margin-top:6px; font-size:11px; color:#A7F3D0; border-top:1px dashed rgba(16,185,129,0.3); padding-top:4px;">
            🛡️ <strong>격리 계약:</strong> 진행도·보상·하이스코어 저장 차단 (Issue #391)
          </div>
        </div>
      `.trim();
    }

    const errorMsg = result.error || '알 수 없는 오류로 테스트 플레이 실행에 실패했습니다.';
    const diagnosticsList =
      result.diagnostics && result.diagnostics.length > 0
        ? `<div style="margin-top:4px; font-size:11px; color:#FCA5A5;">진단: ${result.diagnostics.join(', ')}</div>`
        : '';

    return `
      <div class="feedback-box feedback-error" style="background:rgba(239,68,68,0.15); border:1px solid #EF4444; border-radius:4px; padding:8px 12px; font-size:12px; color:#FEE2E2;">
        <div style="font-weight:700; margin-bottom:2px; color:#FCA5A5;">
          ❌ 테스트 플레이 실행 차단 / 실패
        </div>
        <div style="font-size:12px;">${errorMsg}</div>
        ${diagnosticsList}
      </div>
    `.trim();
  }
}
