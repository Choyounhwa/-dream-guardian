/* Pose rules shared by the game and regression tests. Coordinates are screen pixels. */
(function (root) {
    const HOLD_SECONDS = 0.8;
    const NEUTRAL_SECONDS = 0.6;
    const MAX_FRAME_GAP = 0.6;
    function handCursors(points, baseline, width, height) {
        if (!baseline) return [];
        return [15,16].map(i => {
            const p = points[i];
            if (!visible(p)) return {x:0,y:0,vis:0};
            return { x: width * (0.5 + (p.x-baseline.shoulders.x)/(baseline.torso*2.4)),
                y: height * (0.6 + (p.y-baseline.shoulders.y)/(baseline.torso*6)), vis:p.vis };
        });
    }
    function visible(p) {
        return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.vis >= 0.65;
    }
    function angle(a, b, c) {
        if (![a, b, c].every(visible)) return 0;
        const u = { x: a.x - b.x, y: a.y - b.y };
        const v = { x: c.x - b.x, y: c.y - b.y };
        const length = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
        if (length < 1) return 0;
        return Math.acos(Math.max(-1, Math.min(1, (u.x*v.x + u.y*v.y) / length))) * 180 / Math.PI;
    }
    function body(points) {
        const required = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
        if (!required.every(i => visible(points[i]))) return null;
        const mid = (a, b) => ({ x: (points[a].x + points[b].x)/2, y: (points[a].y + points[b].y)/2 });
        const shoulders = mid(11, 12), hips = mid(23, 24);
        const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
        if (torso < 10) return null;
        const legs = [[23,25,27], [24,26,28]].map(ids => ({
            x: points[ids[2]].x, angle: angle(...ids.map(i => points[i]))
        })).sort((a,b) => a.x - b.x);
        return { shoulders, hips, torso, legs,
            stance: Math.abs(points[27].x - points[28].x),
            shoulderWidth: Math.abs(points[11].x - points[12].x) };
    }
    function neutral(points) {
        const b = body(points);
        return b && b.legs.every(l => l.angle > 155) &&
            Math.abs(b.shoulders.x - b.hips.x) < b.torso * 0.25 &&
            [15,16].every(i => points[i].y > b.shoulders.y + b.torso * 0.45) &&
            b.stance < Math.max(b.shoulderWidth * 1.8, b.torso * 0.85);
    }
    function evaluate(points, baseline, key, target, radius, cursors = [points[15], points[16]]) {
        const b = body(points);
        if (!b || !baseline) return { matched: false, touched: false, hint: '머리부터 발목까지 화면에 보여주세요' };
        const t = baseline.torso;
        let matched = false, hint;
        if (key === 'left' || key === 'right') {
            const side = key === 'left' ? 0 : 1;
            const direction = side === 0 ? -1 : 1;
            const bent = b.legs[side].angle > 80 && b.legs[side].angle < 150;
            const straight = b.legs[1-side].angle > 155;
            const shift = (b.hips.x - baseline.hips.x) * direction > t * 0.10;
            const wide = b.stance > Math.max(b.shoulderWidth * 1.1, t * 0.65);
            matched = bent && straight && shift && wide;
            hint = `${key === 'left' ? '왼쪽' : '오른쪽'} 무릎 굽히기 · 반대 다리는 펴기`;
        } else if (key === 'top') {
            matched = [15,16].every(i => points[i].y < points[0].y - t * 0.12) &&
                angle(points[11], points[13], points[15]) > 145 &&
                angle(points[12], points[14], points[16]) > 145 &&
                b.legs.every(l => l.angle > 155);
            hint = '두 팔을 머리 위로 쭉 펴세요';
        } else if (key === 'bottom') {
            matched = b.legs.every(l => l.angle > 65 && l.angle < 150) &&
                b.hips.y - baseline.hips.y > t * 0.15 &&
                b.shoulders.y - baseline.shoulders.y > t * 0.1 &&
                [15,16].every(i => points[i].y > b.shoulders.y + t * 0.35);
            hint = '양 무릎을 굽혀 엉덩이를 낮추고 손 뻗기';
        }
        const touched = cursors.some(p => visible(p) && Math.hypot(p.x-target.x, p.y-target.y) <= radius);
        return { matched, touched, hint: matched ? (touched ? '그대로 0.8초 유지!' : '자세 OK · 손으로 답 원을 터치하세요') : hint };
    }
    class Gate {
        constructor() { this.reset(); }
        reset() { this.baseline = null; this.neutralTime = 0; this.previous = null; this.selected = null; this.held = 0; }
        interrupt() { this.reset(); }
        update(points, dt, locked, options, radius, cursors) {
            const clear = () => options.forEach(o => { o.dwell = 0; o.isFullBody = false; });
            clear();
            if (locked) { this.reset(); return { hint: '먼저 문제를 읽으세요', choice: null }; }
            const b = body(points);
            if (!b || !(dt > 0) || dt > MAX_FRAME_GAP) {
                this.reset(); return { hint: '머리부터 발목까지 화면에 보여주세요', choice: null };
            }
            if (!this.baseline) {
                const stable = this.previous && Math.hypot(b.shoulders.x-this.previous.x, b.shoulders.y-this.previous.y) / dt < b.torso * 0.35;
                this.neutralTime = neutral(points) && stable ? this.neutralTime + dt : 0;
                this.previous = b.shoulders;
                if (this.neutralTime >= NEUTRAL_SECONDS) this.baseline = b;
                return { hint: this.baseline ? '준비 완료! 그림 자세로 답을 터치하세요' : '달리기를 멈추고 · 두 팔 내리고 · 바로 서기', choice: null };
            }
            const checks = options.map(o => evaluate(points, this.baseline, o.key, o, radius, cursors));
            checks.forEach((r,i) => { options[i].isFullBody = r.matched; });
            const active = checks.map((r,i) => r.matched && r.touched ? i : -1).filter(i => i >= 0);
            if (active.length !== 1) {
                this.selected = null; this.held = 0;
                const feedback = checks.find(r => r.matched) || checks.find(r => r.touched);
                return { hint: feedback ? feedback.hint : '그림 자세를 만든 뒤 손으로 답을 터치하세요', choice: null };
            }
            const i = active[0];
            const credit = Math.min(dt, 0.15);
            this.held = this.selected === i ? this.held + credit : credit;
            this.selected = i;
            options[i].dwell = Math.min(1, this.held / HOLD_SECONDS);
            return { hint: checks[i].hint, choice: this.held + 1e-9 >= HOLD_SECONDS ? options[i] : null };
        }
    }
    const api = { Gate, body, neutral, evaluate, angle, handCursors, HOLD_SECONDS, MAX_FRAME_GAP };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.MotionInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
