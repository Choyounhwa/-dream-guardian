(function(root) {
    function spokenMath(text) {
        return String(text)
            .replace(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, '$2 분의 $1')
            .replace(/×|\*/g, ' 곱하기 ').replace(/÷/g, ' 나누기 ')
            .replace(/\+/g, ' 더하기 ').replace(/−|-/g, ' 빼기 ')
            .replace(/=/g, ' 는 ').replace(/\?/g, ' 얼마일까요? ')
            .replace(/\(/g, ' 괄호 열고 ').replace(/\)/g, ' 괄호 닫고 ')
            .replace(/\s+/g, ' ').trim();
    }
    class Reader {
        constructor(synth, Utterance, notify, timers = {setTimeout, clearTimeout}) {
            this.synth = synth; this.Utterance = Utterance; this.notify = notify;
            this.timers = timers; this.serial = 0; this.timer = null;
            this.startTimer = null;
            this.utterance = null;
        }
        cancel() {
            this.serial++;
            if (this.timer !== null) this.timers.clearTimeout(this.timer);
            if (this.startTimer !== null) this.timers.clearTimeout(this.startTimer);
            this.timer = null;
            this.startTimer = null;
            this.utterance = null;
            if (this.synth) { try { this.synth.cancel(); } catch (_) {} }
        }
        read(text) {
            this.cancel();
            if (!this.synth || !this.Utterance) {
                this.notify('음성 읽기를 지원하지 않는 브라우저입니다', false); return;
            }
            const id = this.serial;
            const utterance = new this.Utterance(spokenMath(text));
            utterance.lang = 'ko-KR'; utterance.rate = 0.9;
            this.utterance = utterance;
            let voices = [];
            try { voices = this.synth.getVoices(); } catch (_) {}
            const korean = voices.find(v => /^ko(?:-|_)/i.test(v.lang));
            if (korean) utterance.voice = korean;
            let finished = false;
            const finish = (message) => {
                if (id !== this.serial || finished) return;
                finished = true;
                if (this.timer !== null) this.timers.clearTimeout(this.timer);
                if (this.startTimer !== null) this.timers.clearTimeout(this.startTimer);
                this.timer = null;
                this.startTimer = null;
                this.utterance = null;
                this.notify(message, false);
            };
            utterance.onend = () => finish('문제를 읽었습니다 · 자세를 준비하세요');
            utterance.onerror = () => finish('음성을 재생하지 못했습니다 · 다시 듣기를 눌러주세요');
            this.notify('문제 음성 안내 · 게임 조작 가능', true);
            utterance.onstart = () => {
                if (id !== this.serial || finished) return;
                if (this.startTimer !== null) this.timers.clearTimeout(this.startTimer);
                this.startTimer = null;
            };
            this.startTimer = this.timers.setTimeout(() => {
                finish('음성이 시작되지 않았습니다 · 다시 듣기로 재생');
                if (id === this.serial) { try { this.synth.cancel(); } catch (_) {} }
            }, 3000);
            // Some mobile browsers do not deliver end/error when speech is blocked.
            this.timer = this.timers.setTimeout(() => {
                finish('음성 읽기가 멈췄습니다 · 다시 듣기를 눌러주세요');
                if (id === this.serial) { try { this.synth.cancel(); } catch (_) {} }
            }, Math.min(180000, Math.max(15000, utterance.text.length * 500)));
            try { this.synth.resume(); this.synth.speak(utterance); }
            catch (_) { finish('음성을 재생하지 못했습니다 · 다시 듣기를 눌러주세요'); }
        }
    }
    const api = {Reader, spokenMath};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QuestionSpeech = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
