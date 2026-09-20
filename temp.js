
    // ==========================================
    // 웹 오디오 API 신디사이저 (효과음 & BGM)
    // ==========================================
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    function playSound(type) {
      if(audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;
      if (type === 'correct') { 
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, now); 
          osc.frequency.setValueAtTime(523.25, now + 0.2); 
          gainNode.gain.setValueAtTime(0.5, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
      } else if (type === 'wrong') { 
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gainNode.gain.setValueAtTime(0.3, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
      } else if (type === 'hover') { 
          osc.type = 'square';
          osc.frequency.setValueAtTime(400, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
      } else if (type === 'start') { 
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now); 
          osc.frequency.setValueAtTime(659.25, now + 0.1); 
          osc.frequency.setValueAtTime(783.99, now + 0.2); 
          osc.frequency.setValueAtTime(1046.50, now + 0.3); 
          gainNode.gain.setValueAtTime(0.3, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
          osc.start(now);
          osc.stop(now + 0.6);
      } else if (type === 'combo') { 
          const bufferSize = audioCtx.sampleRate * 2;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;
          const noiseFilter = audioCtx.createBiquadFilter();
          noiseFilter.type = 'lowpass';
          noiseFilter.frequency.setValueAtTime(800, now);
          noiseFilter.frequency.exponentialRampToValueAtTime(50, now + 1.0);
          const noiseGain = audioCtx.createGain();
          noiseGain.gain.setValueAtTime(1.5, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
          noise.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(audioCtx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(20, now + 1.0);
          gainNode.gain.setValueAtTime(1.5, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
          
          noise.start(now);
          noise.stop(now + 1.0);
          osc.start(now);
          osc.stop(now + 1.0);
      } else if (type === 'magic_cast') {
          // 마법 빔/미사일 발사음 (크리스탈 치솟는 음)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);
          gainNode.gain.setValueAtTime(0.35, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);

          const bell = audioCtx.createOscillator();
          const bellGain = audioCtx.createGain();
          bell.type = 'sine';
          bell.frequency.setValueAtTime(880, now);
          bell.frequency.setValueAtTime(1760, now + 0.12);
          bellGain.gain.setValueAtTime(0.25, now);
          bellGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
          bell.connect(bellGain);
          bellGain.connect(audioCtx.destination);
          bell.start(now);
          bell.stop(now + 0.55);
      } else if (type === 'magic_fireball') {
          // 파이어볼 발사음 (작열 화염 돌진음)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(750, now + 0.35);
          gainNode.gain.setValueAtTime(0.45, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);

          const rNoise = audioCtx.createBufferSource();
          const bSize = audioCtx.sampleRate * 0.45;
          const bBuf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
          const bData = bBuf.getChannelData(0);
          for (let i = 0; i < bSize; i++) bData[i] = Math.random() * 2 - 1;
          rNoise.buffer = bBuf;
          const rFlt = audioCtx.createBiquadFilter();
          rFlt.type = 'bandpass';
          rFlt.frequency.setValueAtTime(450, now);
          rFlt.frequency.exponentialRampToValueAtTime(120, now + 0.45);
          const rG = audioCtx.createGain();
          rG.gain.setValueAtTime(0.7, now);
          rG.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          rNoise.connect(rFlt);
          rFlt.connect(rG);
          rG.connect(audioCtx.destination);
          rNoise.start(now);
          rNoise.stop(now + 0.45);
      } else if (type === 'magic_frost') {
          // 냉기폭발 발사음 (빙결 서리 고음)
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(2200, now + 0.35);
          gainNode.gain.setValueAtTime(0.4, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);

          const cOsc = audioCtx.createOscillator();
          const cG = audioCtx.createGain();
          cOsc.type = 'triangle';
          cOsc.frequency.setValueAtTime(1400, now);
          cOsc.frequency.setValueAtTime(3200, now + 0.15);
          cG.gain.setValueAtTime(0.35, now);
          cG.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          cOsc.connect(cG);
          cG.connect(audioCtx.destination);
          cOsc.start(now);
          cOsc.stop(now + 0.45);
      } else if (type === 'fire_explode') {
          // 파이어볼 피격 후 화염 폭발음
          const bSize = audioCtx.sampleRate * 0.9;
          const bBuf = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
          const bData = bBuf.getChannelData(0);
          for (let i = 0; i < bSize; i++) bData[i] = Math.random() * 2 - 1;
          const fSrc = audioCtx.createBufferSource();
          fSrc.buffer = bBuf;
          const fFlt = audioCtx.createBiquadFilter();
          fFlt.type = 'lowpass';
          fFlt.frequency.setValueAtTime(700, now);
          fFlt.frequency.exponentialRampToValueAtTime(30, now + 0.85);
          const fg = audioCtx.createGain();
          fg.gain.setValueAtTime(1.4, now);
          fg.gain.exponentialRampToValueAtTime(0.01, now + 0.85);
          fSrc.connect(fFlt);
          fFlt.connect(fg);
          fg.connect(audioCtx.destination);
          fSrc.start(now);
          fSrc.stop(now + 0.85);
      } else if (type === 'ice_freeze') {
          // 냉기폭발 피격 빙결음 (얼음 결정 깨지는 크리스탈음)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(2400, now);
          osc.frequency.exponentialRampToValueAtTime(350, now + 0.4);
          gainNode.gain.setValueAtTime(0.45, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
      } else if (type === 'monster_hit') {
          // 몬스터 피격 폭발음 + 드래곤 포효
          const bufferSize = audioCtx.sampleRate * 1.2;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, now);
          filter.frequency.exponentialRampToValueAtTime(30, now + 0.9);
          const nGain = audioCtx.createGain();
          nGain.gain.setValueAtTime(1.4, now);
          nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(audioCtx.destination);
          noise.start(now);
          noise.stop(now + 0.9);

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.exponentialRampToValueAtTime(25, now + 0.9);
          gainNode.gain.setValueAtTime(1.2, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
          osc.start(now);
          osc.stop(now + 0.9);
      } else if (type === 'fizzle') {
          // 오답 시 문제가 푸스스 재로 흩어지는 사운드
          const bufferSize = audioCtx.sampleRate * 0.8;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1200, now);
          filter.frequency.exponentialRampToValueAtTime(160, now + 0.7);
          filter.Q.value = 2.5;
          const nGain = audioCtx.createGain();
          nGain.gain.setValueAtTime(0.45, now);
          nGain.gain.exponentialRampToValueAtTime(0.005, now + 0.7);
          noise.connect(filter);
          filter.connect(nGain);
          nGain.connect(audioCtx.destination);
          noise.start(now);
          noise.stop(now + 0.7);
      } else if (type === 'shatter') {
          // 문제가 바스라지는 룬 크리스탈 셰터링 사운드
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1300, now);
          osc.frequency.setValueAtTime(2400, now + 0.06);
          osc.frequency.setValueAtTime(800, now + 0.16);
          gainNode.gain.setValueAtTime(0.35, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
      } else if (type === 'player_hurt') {
          // 플레이어 피격 및 발톱 할퀴기 사운드
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);
          gainNode.gain.setValueAtTime(0.5, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);

          const hNoise = audioCtx.createBufferSource();
          const nSz = audioCtx.sampleRate * 0.2;
          const nBuf = audioCtx.createBuffer(1, nSz, audioCtx.sampleRate);
          const nDat = nBuf.getChannelData(0);
          for(let i=0; i<nSz; i++) nDat[i] = Math.random()*2 - 1;
          hNoise.buffer = nBuf;
          const hFlt = audioCtx.createBiquadFilter();
          hFlt.type = 'bandpass';
          hFlt.frequency.value = 1700;
          const hG = audioCtx.createGain();
          hG.gain.setValueAtTime(0.55, now);
          hG.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          hNoise.connect(hFlt); hFlt.connect(hG); hG.connect(audioCtx.destination);
          hNoise.start(now); hNoise.stop(now + 0.2);
      }
    }

    let crossOsc = null;
    let crossGain = null;
    let crossLfo = null;
    function startCrossSound() {
      if(crossOsc) return;
      if(audioCtx.state === 'suspended') audioCtx.resume();
      crossOsc = audioCtx.createOscillator();
      crossGain = audioCtx.createGain();
      crossOsc.type = 'triangle';
      crossOsc.frequency.value = 150; 
      
      crossLfo = audioCtx.createOscillator();
      crossLfo.type = 'sine';
      crossLfo.frequency.value = 4; 
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.5;
      
      crossLfo.connect(lfoGain);
      lfoGain.connect(crossGain.gain);
      crossGain.gain.value = 0.08; 
      
      crossOsc.connect(crossGain);
      crossGain.connect(audioCtx.destination);
      
      crossOsc.start();
      crossLfo.start();
    }

    function stopCrossSound() {
      if(crossOsc) {
        crossOsc.stop();
        crossLfo.stop();
        crossOsc.disconnect();
        crossGain.disconnect();
        crossOsc = null;
        crossLfo = null;
      }
    }

    const notesNormal = [261.63, 329.63, 392.00, 329.63, 261.63, 329.63, 392.00, 440.00]; 
    const notesFever = [523.25, 659.25, 783.99, 659.25, 523.25, 659.25, 1046.50, 783.99]; 
    let bgmStep = 0;
    let isFeverTime = false;
    let bgmInterval = null;
    let bgmEnabled = false;

    function bgmLoop() {
        if(audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = isFeverTime ? 'square' : 'triangle';
        const arr = isFeverTime ? notesFever : notesNormal;
        const note = arr[bgmStep % arr.length];
        bgmStep++;
        osc.frequency.setValueAtTime(note, now);
        
        if (isFeverTime) {
           const osc2 = audioCtx.createOscillator();
           osc2.type = 'sawtooth';
           osc2.frequency.setValueAtTime(note * 1.01, now);
           osc2.connect(gain);
           osc2.start(now);
           osc2.stop(now + 0.15);
        }
        
        gain.gain.setValueAtTime(isFeverTime ? 0.08 : 0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isFeverTime ? 0.15 : 0.25));
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + (isFeverTime ? 0.15 : 0.25));
    }

    function startBGM() {
        if (bgmInterval) return;
        bgmEnabled = true;
        bgmStep = 0;
        bgmInterval = setInterval(bgmLoop, isFeverTime ? 120 : 200);
    }

    function updateBGM(fever) {
        if (fever !== isFeverTime) {
            isFeverTime = fever;
            if (bgmInterval) {
                clearInterval(bgmInterval);
                bgmInterval = setInterval(bgmLoop, isFeverTime ? 120 : 200);
            }
        }
    }

    function stopBGM() {
        if (bgmInterval) {
            clearInterval(bgmInterval);
            bgmInterval = null;
        }
    }

    // ==========================================
    // 판타지 RPG 비주얼 엔진 & 보스 시스템
    // ==========================================
    const imgBossDragon = document.getElementById('img_boss_dragon');
    const imgParchment = document.getElementById('img_parchment_scroll');
    let transparentDragonCanvas = null;

    function initDragonSprite() {
      if (!imgBossDragon || transparentDragonCanvas) return;
      if (!imgBossDragon.complete || imgBossDragon.naturalWidth === 0) {
        imgBossDragon.onload = initDragonSprite;
        return;
      }
      try {
        const off = document.createElement('canvas');
        off.width = imgBossDragon.naturalWidth;
        off.height = imgBossDragon.naturalHeight;
        const octx = off.getContext('2d');
        octx.drawImage(imgBossDragon, 0, 0);
        const imgData = octx.getImageData(0, 0, off.width, off.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i+1], b = d[i+2];
          const maxVal = Math.max(r, Math.max(g, b));
          if (maxVal < 25) {
            d[i+3] = 0;
          } else if (maxVal < 70) {
            d[i+3] = Math.floor(255 * ((maxVal - 25) / 45));
          }
        }
        octx.putImageData(imgData, 0, 0);
        transparentDragonCanvas = off;
      } catch(e) {
        console.warn("Direct sprite processing fallback:", e);
        transparentDragonCanvas = imgBossDragon;
      }
    }
    window.addEventListener('load', initDragonSprite);
    if (imgBossDragon && imgBossDragon.complete) initDragonSprite();

    // 거대 보스 몬스터 컨트롤러
    const boss = {
      active: true,
      hp: 10,
      maxHp: 10,
      displayHp: 10,
      x: 0,
      y: 0,
      size: 0,
      hurtTimer: 0,
      roarTimer: 0,
      defeatTimer: 0,
      burningTimer: 0,
      frozenTimer: 0,
      frostFloorTimer: 0,
      reset(maxHp) {
        this.active = true;
        this.hp = maxHp || 10;
        this.maxHp = this.hp;
        this.displayHp = this.hp;
        this.hurtTimer = 0;
        this.roarTimer = 0;
        this.defeatTimer = 0;
        this.burningTimer = 0;
        this.frozenTimer = 0;
        this.frostFloorTimer = 0;
      },
      update(width, height) {
        this.x = width / 2;
        this.y = height * 0.23;
        this.size = Math.min(width * 0.42, height * 0.38);
        if (this.hurtTimer > 0) this.hurtTimer--;
        if (this.roarTimer > 0) this.roarTimer--;
        if (this.burningTimer > 0) this.burningTimer--;
        if (this.frozenTimer > 0) this.frozenTimer--;
        if (this.frostFloorTimer > 0) this.frostFloorTimer--;
        this.displayHp += (this.hp - this.displayHp) * 0.15;
      },
      draw(ctx, width, height) {
        if (!this.active) return;
        this.update(width, height);
        ctx.save();
        
        const floatY = Math.sin(Date.now() / 450) * 8;
        const breath = 1.0 + Math.sin(Date.now() / 700) * 0.025;
        let bx = this.x;
        let by = this.y + floatY;

        if (this.hurtTimer > 0) {
          bx += (Math.random() - 0.5) * 35;
          by += (Math.random() - 0.5) * 20;
        }

        ctx.translate(bx, by);
        ctx.scale(breath, breath);

        if (this.hurtTimer > 0) {
          ctx.filter = 'brightness(2.2) drop-shadow(0 0 40px #ff2200)';
        } else if (this.burningTimer > 0) {
          ctx.filter = 'brightness(1.6) saturate(1.8) drop-shadow(0 0 45px #ff4500)';
        } else if (this.frozenTimer > 0) {
          ctx.filter = 'brightness(1.5) hue-rotate(160deg) saturate(1.4) drop-shadow(0 0 45px #00e5ff)';
        } else if (this.roarTimer > 0) {
          ctx.filter = 'brightness(1.4) drop-shadow(0 0 30px #ff4500)';
        } else {
          ctx.filter = 'drop-shadow(0 0 25px rgba(255, 68, 0, 0.4))';
        }

        const sprite = transparentDragonCanvas || imgBossDragon;
        if (sprite) {
          if (sprite === imgBossDragon) ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(sprite, -this.size / 2, -this.size / 2, this.size, this.size);
        }

        // 보스 빙결 시 얼음 결정 오버레이
        if (this.frozenTimer > 0) {
          ctx.save();
          ctx.strokeStyle = '#bbf2f6';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 15;
          for (let f = 0; f < 6; f++) {
            const fa = (f / 6) * Math.PI * 2;
            const fx = Math.cos(fa) * (this.size * 0.32);
            const fy = Math.sin(fa) * (this.size * 0.32);
            ctx.beginPath();
            ctx.moveTo(fx - 15, fy); ctx.lineTo(fx + 15, fy);
            ctx.moveTo(fx, fy - 15); ctx.lineTo(fx, fy + 15);
            ctx.moveTo(fx - 10, fy - 10); ctx.lineTo(fx + 10, fy + 10);
            ctx.moveTo(fx - 10, fy + 10); ctx.lineTo(fx + 10, fy - 10);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.restore();

        // 보스 화염 피격 불길 렌더링
        if (this.burningTimer > 0) {
          drawBossBurningFlames(ctx, this);
        }

        // 보스 오답 포효 충격파 이펙트
        if (this.roarTimer > 0) {
          ctx.save();
          const waveR = (35 - this.roarTimer) * (width * 0.04);
          ctx.beginPath();
          ctx.arc(this.x, this.y, waveR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 60, 0, ${this.roarTimer / 35})`;
          ctx.lineWidth = 14 * (this.roarTimer / 35);
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 25;
          ctx.stroke();
          ctx.restore();
        }
      },
      drawHpBar(ctx, width, height) {
        if (!this.active) return;
        const barW = Math.min(width * 0.52, 560);
        const barH = Math.max(22, height * 0.030);
        const barX = width / 2 - barW / 2;
        const barY = height * 0.088;

        ctx.save();
        // 외곽 엔틱 프레임
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#1c0e07';
        ctx.fillRect(barX - 5, barY - 5, barW + 10, barH + 10);

        // 게이지 배경
        ctx.fillStyle = 'rgba(45, 10, 5, 0.9)';
        ctx.fillRect(barX, barY, barW, barH);

        // 마그마/루비 체력 채우기
        const fillRatio = Math.max(0, Math.min(1, this.displayHp / this.maxHp));
        const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
        hpGrad.addColorStop(0, '#ffaa00');
        hpGrad.addColorStop(0.3, '#ff2b00');
        hpGrad.addColorStop(0.7, '#cc0000');
        hpGrad.addColorStop(1, '#660000');
        ctx.fillStyle = hpGrad;
        ctx.fillRect(barX, barY, barW * fillRatio, barH);

        // 10분할 눈금 세그먼트
        ctx.strokeStyle = '#1c0e07';
        ctx.lineWidth = 2.5;
        for (let i = 1; i < this.maxHp; i++) {
          const px = barX + (barW * (i / this.maxHp));
          ctx.beginPath();
          ctx.moveTo(px, barY);
          ctx.lineTo(px, barY + barH);
          ctx.stroke();
        }

        // 황금 몰딩 테두리
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(barX, barY, barW, barH);

        // 모서리 장식 핀
        ctx.fillStyle = '#ffe082';
        [[barX, barY], [barX + barW, barY], [barX, barY + barH], [barX + barW, barY + barH]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // 보스 명칭 & 체력 표기 (체력바 내부에 균형감 있게 배치)
        ctx.font = `bold ${Math.floor(barH * 0.68)}px 'Cinzel', 'Gowun Batang', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe082';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(`[BOSS] 고대 화염룡 알렉스트라자  HP: ${Math.ceil(this.hp)} / ${this.maxHp}`, width / 2, barY + barH / 2);

        ctx.restore();
      }
    };

    // ==========================================
    // 보스 피격 화염 불길 & 냉기 바닥/블리자드 이펙트
    // ==========================================
    function drawBossBurningFlames(ctx, b) {
      ctx.save();
      const numFlames = 16;
      for (let i = 0; i < numFlames; i++) {
        const offsetAng = (i / numFlames) * Math.PI * 2;
        const radius = (b.size * 0.38) * (0.6 + Math.sin(Date.now() * 0.007 + i) * 0.4);
        const fx = b.x + Math.cos(offsetAng) * radius;
        const fy = b.y + Math.sin(offsetAng) * radius * 0.65 - (b.size * 0.08);
        const flameH = (Math.sin(Date.now() * 0.015 + i * 2) * 0.5 + 0.5) * (b.size * 0.42) + 20;
        const flameW = flameH * 0.42;

        ctx.save();
        ctx.translate(fx, fy);
        ctx.beginPath();
        ctx.moveTo(-flameW / 2, 0);
        ctx.quadraticCurveTo(-flameW * 0.8, -flameH * 0.6, 0, -flameH);
        ctx.quadraticCurveTo(flameW * 0.8, -flameH * 0.6, flameW / 2, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, -flameH);
        grad.addColorStop(0, 'rgba(255, 50, 0, 0.85)');
        grad.addColorStop(0.4, 'rgba(255, 150, 0, 0.85)');
        grad.addColorStop(0.8, 'rgba(255, 230, 80, 0.9)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
      }

      // 튀는 불똥 에머 파티클
      for (let j = 0; j < 10; j++) {
        const t = (Date.now() * 0.003 + j * 0.3) % 1;
        const ex = b.x + (Math.sin(j * 3.7 + Date.now() * 0.004)) * (b.size * 0.45);
        const ey = b.y + (b.size * 0.2) - t * (b.size * 0.85);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ex, ey, (1 - t) * 4.5 + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe066';
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 1 - t;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    let blizzardSnowflakes = [];
    function drawFrostFloorAndBlizzard(ctx, width, height, timer) {
      ctx.save();
      const alpha = Math.min(1.0, timer / 30);
      const floorY = height * 0.68;
      const floorH = height - floorY;

      // 1. 바닥에 얼어붙는 냉기 얼음판 (아이스 시트)
      const iceGrad = ctx.createLinearGradient(0, floorY, 0, height);
      iceGrad.addColorStop(0, `rgba(180, 240, 255, ${0.40 * alpha})`);
      iceGrad.addColorStop(0.25, `rgba(100, 210, 255, ${0.55 * alpha})`);
      iceGrad.addColorStop(0.65, `rgba(40, 140, 220, ${0.70 * alpha})`);
      iceGrad.addColorStop(1, `rgba(10, 40, 100, ${0.80 * alpha})`);
      ctx.fillStyle = iceGrad;
      ctx.fillRect(0, floorY, width, floorH);

      // 서리 크랙 & 빙결 룬 패턴
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * alpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 7; i++) {
        const cx = (width / 8) * (i + 1);
        const cy = floorY + (floorH * 0.42);
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy); ctx.lineTo(cx + 35, cy);
        ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy + 22);
        ctx.moveTo(cx - 22, cy - 18); ctx.lineTo(cx + 22, cy + 18);
        ctx.moveTo(cx - 22, cy + 18); ctx.lineTo(cx + 22, cy - 18);
        ctx.stroke();
      }
      ctx.restore();

      // 2. 바닥에서 위로 솟구치며 휘날리는 눈발 블리자드
      if (blizzardSnowflakes.length < 85) {
        for (let k = 0; k < 5; k++) {
          blizzardSnowflakes.push({
            x: Math.random() * width,
            y: height + Math.random() * 20,
            vx: (Math.random() - 0.5) * 5 + 3,
            vy: -(Math.random() * 6.5 + 3.5),
            size: Math.random() * 4.5 + 2,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.15,
            alpha: Math.random() * 0.8 + 0.2
          });
        }
      }

      for (let i = blizzardSnowflakes.length - 1; i >= 0; i--) {
        const s = blizzardSnowflakes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vrot;
        s.alpha -= 0.009;

        if (s.y < height * 0.15 || s.x > width + 60 || s.alpha <= 0) {
          blizzardSnowflakes.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = `rgba(235, 250, 255, ${s.alpha * alpha})`;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // ==========================================
    // 파티클 & 스펠 프로젝타일 시스템
    // ==========================================
    let questionShatterParticles = [];
    let spellProjectiles = [];
    let questionFizzleParticles = [];
    let orbSurgeEffect = { left: 0, right: 0 };

    // 정답 시 문제가 바스라져 룬 구체로 수렴
    function startQuestionShatter(text, qX, qY, qW, qH, targetX, targetY, isLeft, spellType, combo) {
      playSound('shatter');
      questionShatterParticles = [];
      const count = 75;
      const chars = (text || "고대연산마법").split('');
      for (let i = 0; i < count; i++) {
        const rx = qX + (Math.random() - 0.5) * qW * 0.85;
        const ry = qY + (Math.random() - 0.5) * qH * 0.7;
        const burstAngle = Math.random() * Math.PI * 2;
        const burstSpeed = Math.random() * 9 + 4;
        questionShatterParticles.push({
          x: rx,
          y: ry,
          vx: Math.cos(burstAngle) * burstSpeed,
          vy: Math.sin(burstAngle) * burstSpeed,
          targetX: targetX,
          targetY: targetY,
          size: Math.random() * 12 + 6,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.35,
          alpha: 1.0,
          char: chars[i % chars.length] || '✦',
          life: 0,
          maxLife: 35 + Math.random() * 15,
          color: spellType === 'fireball' ? (Math.random() > 0.4 ? '#ff6600' : '#ffd700') : (Math.random() > 0.4 ? '#00e5ff' : '#ffffff'),
          isLeft: isLeft,
          spellType: spellType,
          combo: combo
        });
      }
    }

    // 오답 시 문제가 푸스스 재로 분해
    function startQuestionFizzle(text, qX, qY, qW, qH) {
      playSound('fizzle');
      questionFizzleParticles = [];
      const count = 90;
      for (let i = 0; i < count; i++) {
        const rx = qX + (Math.random() - 0.5) * qW * 0.85;
        const ry = qY + (Math.random() - 0.5) * qH * 0.75;
        questionFizzleParticles.push({
          x: rx,
          y: ry,
          vx: (Math.random() - 0.5) * 4.5,
          vy: (Math.random() * 2 + 1) * -0.6 + 1.4, // 서서히 흩날리며 가라앉음
          size: Math.random() * 11 + 4,
          alpha: 1.0,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.15,
          color: Math.random() > 0.5 ? 'rgba(80, 80, 80, ' : 'rgba(140, 130, 120, ',
          decay: Math.random() * 0.018 + 0.015
        });
      }
      boss.roarTimer = 35; // 보스 포효 유발
    }

    // 구체에서 보스로 발사되는 마법 (파이어볼 / 냉기폭발)
    function spawnSpellProjectile(startX, startY, targetX, targetY, isCombo, spellType) {
      const type = spellType || 'fireball';
      if (type === 'fireball') {
        playSound('magic_fireball');
      } else {
        playSound('magic_frost');
      }
      spellProjectiles.push({
        x: startX,
        y: startY,
        targetX: targetX,
        targetY: targetY,
        startX: startX,
        startY: startY,
        progress: 0,
        speed: 0.075,
        isCombo: isCombo,
        spellType: type,
        trail: []
      });
    }

    // 판타지 파티클 및 스펠 업데이트 & 드로잉
    function updateAndDrawFantasyEffects(ctx) {
      // 0. 보스 냉기 피격 시 바닥 서리 및 블리자드 효과
      if (boss.frostFloorTimer > 0) {
        drawFrostFloorAndBlizzard(ctx, ctx.canvas.width, ctx.canvas.height, boss.frostFloorTimer);
      }

      // 1. 바스라지는 룬 파편 (구체로 수렴)
      let targetOrbHit = null;
      for (let i = questionShatterParticles.length - 1; i >= 0; i--) {
        let p = questionShatterParticles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        // 목표 룬 구체로 강한 마나 자기력 발생
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        const pull = Math.min(1.8, (p.life / p.maxLife) * 2.2);

        p.vx = p.vx * 0.88 + (dx / (dist + 1)) * pull * 14;
        p.vy = p.vy * 0.88 + (dy / (dist + 1)) * pull * 14;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.font = `bold ${Math.floor(p.size)}px 'Gowun Batang', serif`;
        ctx.fillText(p.char, 0, 0);
        ctx.restore();

        if (dist < 30 || p.life >= p.maxLife) {
          targetOrbHit = { x: p.targetX, y: p.targetY, isLeft: p.isLeft, spellType: p.spellType, combo: p.combo };
          questionShatterParticles.splice(i, 1);
        }
      }

      // 파편이 구체에 도달하여 마나 임팩트 & 마법 발사
      if (targetOrbHit && questionShatterParticles.length === 0) {
        if (targetOrbHit.isLeft) orbSurgeEffect.left = 1.0;
        else orbSurgeEffect.right = 1.0;
        spawnSpellProjectile(targetOrbHit.x, targetOrbHit.y, boss.x, boss.y, targetOrbHit.combo >= 3, targetOrbHit.spellType);
      }

      // 2. 푸스스 소멸하는 재 & 연기 파티클
      for (let i = questionFizzleParticles.length - 1; i >= 0; i--) {
        let p = questionFizzleParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          questionFizzleParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. 발사되는 마법 투사체 (오른손: 파이어볼, 왼손: 냉기폭발)
      for (let i = spellProjectiles.length - 1; i >= 0; i--) {
        let sp = spellProjectiles[i];
        sp.progress += sp.speed;
        let curX = sp.startX + (sp.targetX - sp.startX) * sp.progress;
        let curY = sp.startY + (sp.targetY - sp.startY) * sp.progress;
        sp.trail.push({ x: curX, y: curY, alpha: 1.0 });

        ctx.save();
        if (sp.spellType === 'fireball') {
          // [파이어볼 트레일 & 코어]
          for (let t = 0; t < sp.trail.length; t++) {
            let tr = sp.trail[t];
            tr.alpha -= 0.055;
            if (tr.alpha > 0) {
              ctx.beginPath();
              ctx.arc(tr.x, tr.y, (sp.isCombo ? 30 : 18) * tr.alpha, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, ${Math.floor(100 + tr.alpha * 120)}, 0, ${tr.alpha * 0.7})`;
              ctx.shadowColor = '#ff4500';
              ctx.shadowBlur = 18;
              ctx.fill();
            }
          }
          // 파이어볼 헤드 코어
          ctx.beginPath();
          ctx.arc(curX, curY, sp.isCombo ? 40 : 26, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 60, 0, 0.45)';
          ctx.shadowColor = '#ff2200';
          ctx.shadowBlur = 35;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(curX, curY, sp.isCombo ? 26 : 17, 0, Math.PI * 2);
          ctx.fillStyle = '#fff8e7';
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 22;
          ctx.fill();

        } else {
          // [냉기폭발 트레일 & 크리스탈 코어]
          for (let t = 0; t < sp.trail.length; t++) {
            let tr = sp.trail[t];
            tr.alpha -= 0.055;
            if (tr.alpha > 0) {
              ctx.beginPath();
              ctx.arc(tr.x, tr.y, (sp.isCombo ? 28 : 16) * tr.alpha, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(0, 220, 255, ${tr.alpha * 0.7})`;
              ctx.shadowColor = '#00f0ff';
              ctx.shadowBlur = 18;
              ctx.fill();
            }
          }
          // 서리 아우라
          ctx.beginPath();
          ctx.arc(curX, curY, sp.isCombo ? 38 : 24, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 200, 255, 0.35)';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 35;
          ctx.fill();

          // 회전하는 다이아몬드 얼음 결정 헤드
          ctx.save();
          ctx.translate(curX, curY);
          ctx.rotate(Date.now() * 0.012);
          const cryS = sp.isCombo ? 24 : 15;
          ctx.beginPath();
          ctx.moveTo(0, -cryS * 1.3);
          ctx.lineTo(cryS, 0);
          ctx.lineTo(0, cryS * 1.3);
          ctx.lineTo(-cryS, 0);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 25;
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // 보스에 명중 시 폭발 및 상태이상 부여
        if (sp.progress >= 1.0) {
          boss.hurtTimer = 35;
          boss.hp = Math.max(0, boss.maxHp - questionCount);

          if (sp.spellType === 'fireball') {
            boss.burningTimer = 140; // 화염 지속 연소
            playSound('fire_explode');
            createFireImpactParticles(boss.x, boss.y, sp.isCombo);
          } else {
            boss.frozenTimer = 120; // 빙결
            boss.frostFloorTimer = 160; // 바닥 얼음 및 눈발
            playSound('ice_freeze');
            createFrostImpactParticles(boss.x, boss.y, sp.isCombo);
          }
          spellProjectiles.splice(i, 1);
        }
      }
    }

    // ==========================================
    // 고풍스러운 양피지 두루마리 박스 렌더러
    // ==========================================
    function drawParchmentScroll(ctx, x, y, w, h, titleText) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;

      const rollW = Math.max(16, Math.min(32, w * 0.04));
      const bodyX = x + rollW;
      const bodyW = w - rollW * 2;

      // 양피지 본체 그라디언트
      const paperGrad = ctx.createLinearGradient(bodyX, y, bodyX + bodyW, y + h);
      paperGrad.addColorStop(0, '#fbf4e2');
      paperGrad.addColorStop(0.3, '#f2dfb6');
      paperGrad.addColorStop(0.7, '#e4ca93');
      paperGrad.addColorStop(1, '#caa769');
      ctx.fillStyle = paperGrad;
      ctx.fillRect(bodyX, y, bodyW, h);

      // 양피지 텍스처 은은한 블렌딩 오버레이
      if (imgParchment && imgParchment.complete && imgParchment.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(imgParchment, bodyX, y, bodyW, h);
        ctx.restore();
      }

      // 태운 듯한 가장자리 비넷 음영
      ctx.strokeStyle = '#7c5324';
      ctx.lineWidth = 3;
      ctx.strokeRect(bodyX, y, bodyW, h);

      // 좌측 말린 두루마리 롤
      const leftRollGrad = ctx.createLinearGradient(x, y, x + rollW, y);
      leftRollGrad.addColorStop(0, '#754b20');
      leftRollGrad.addColorStop(0.5, '#e4ca93');
      leftRollGrad.addColorStop(1, '#533211');
      ctx.fillStyle = leftRollGrad;
      ctx.beginPath();
      ctx.roundRect(x, y - 5, rollW, h + 10, 6);
      ctx.fill();
      ctx.stroke();

      // 우측 말린 두루마리 롤
      const rightRollGrad = ctx.createLinearGradient(x + w - rollW, y, x + w, y);
      rightRollGrad.addColorStop(0, '#533211');
      rightRollGrad.addColorStop(0.5, '#e4ca93');
      rightRollGrad.addColorStop(1, '#754b20');
      ctx.fillStyle = rightRollGrad;
      ctx.beginPath();
      ctx.roundRect(x + w - rollW, y - 5, rollW, h + 10, 6);
      ctx.fill();
      ctx.stroke();

      // 황금 테두리 몰딩
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bodyX + 8, y + 8, bodyW - 16, h - 16);

      // 모서리 룬 인장 핀
      ctx.fillStyle = '#b8860b';
      [[bodyX + 8, y + 8], [bodyX + bodyW - 8, y + 8], [bodyX + 8, y + h - 8], [bodyX + bodyW - 8, y + h - 8]].forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff2b2';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      if (titleText) {
        ctx.font = `bold ${Math.max(18, Math.floor(h * 0.28))}px 'Cinzel', 'Gowun Batang', serif`;
        ctx.fillStyle = '#3e240f';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(255, 230, 180, 0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(titleText, x + w / 2, y + 14);
      }

      ctx.restore();
    }

    // ==========================================
    // 황금 룬 메달리온 (메뉴 버튼 렌더러)
    // ==========================================
    function drawOrnateMedallion(ctx, box) {
      ctx.save();
      const cx = box.cx;
      const cy = box.cy;
      const r = box.r;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      // 1. 외곽 황금 링 베젤
      const goldGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
      goldGrad.addColorStop(0, '#ffe89e');
      goldGrad.addColorStop(0.5, '#d4af37');
      goldGrad.addColorStop(0.8, '#aa771c');
      goldGrad.addColorStop(1, '#4e3309');
      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 2. 내부 양피지/에나멜 코어
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.82);
      coreGrad.addColorStop(0, box.hovered ? '#fff3d1' : '#f5e4bc');
      coreGrad.addColorStop(0.7, box.hovered ? '#ebcca0' : '#deb887');
      coreGrad.addColorStop(1, '#8b5a2b');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.fill();

      // 3. 프로그레스 호 (호버 시 충전되는 아케인 룬 링)
      if (box.progress > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.92, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * (box.progress / 100)));
        ctx.lineWidth = r * 0.16;
        ctx.strokeStyle = '#00ffcc';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 15;
        ctx.stroke();

        // 링 끝단 스파크 파티클
        const endAngle = -Math.PI / 2 + (2 * Math.PI * (box.progress / 100));
        const spX = cx + Math.cos(endAngle) * (r * 0.92);
        const spY = cy + Math.sin(endAngle) * (r * 0.92);
        ctx.beginPath();
        ctx.arc(spX, spY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // 4. 황금 톱니/리벳 테두리
      ctx.strokeStyle = '#ffe89e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      // 플래시 효과
      if (box.flash > 0 && box.flash % 6 < 3) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. 세피아 잉크 텍스트
      let fontSz = Math.min(Math.floor(r * 0.38), Math.floor((r * 1.8) / (box.text.length * 0.72)));
      if (fontSz < 16) fontSz = 16;
      ctx.font = `bold ${fontSz}px 'Cinzel', 'Gowun Batang', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = (box.flash > 0 && box.flash % 6 < 3) ? '#000000' : '#2b1704';
      ctx.shadowColor = 'rgba(255, 240, 200, 0.7)';
      ctx.shadowBlur = 3;

      let lines = box.text.split('\n');
      if (lines.length === 1) {
        ctx.fillText(box.text, cx, cy);
      } else {
        ctx.fillText(lines[0], cx, cy - fontSz * 0.6);
        ctx.fillText(lines[1], cx, cy + fontSz * 0.6);
      }

      ctx.restore();
    }

    // ==========================================
    // 마법 룬 구체 (좌/우 정답 타격 타겟 렌더러)
    // ==========================================
    function drawRuneOrb(ctx, cx, cy, r, text, isLeft, isOccupied, isCross) {
      ctx.save();
      const pulse = Math.sin(Date.now() / 250) * 4;
      const effectiveR = r + (isOccupied ? 8 : 0) + pulse;

      // 1. 외곽 마나 아우라
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR + 15, 0, Math.PI * 2);
      ctx.fillStyle = isLeft 
        ? (isOccupied ? 'rgba(0, 220, 255, 0.6)' : 'rgba(0, 150, 255, 0.25)')
        : (isOccupied ? 'rgba(255, 100, 0, 0.6)' : 'rgba(255, 40, 0, 0.25)');
      ctx.shadowColor = isLeft ? '#00e5ff' : '#ff4500';
      ctx.shadowBlur = isOccupied ? 35 : 18;
      ctx.fill();

      // 2. 황금 용발톱 / 비전 베젤 프레임
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR + 6, 0, Math.PI * 2);
      const bezelGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      bezelGrad.addColorStop(0, '#fff4b8');
      bezelGrad.addColorStop(0.5, '#d4af37');
      bezelGrad.addColorStop(1, '#5c3a00');
      ctx.strokeStyle = bezelGrad;
      ctx.lineWidth = 8;
      ctx.stroke();

      // 3. 구체 내부 보석 렌더링 (좌: 사파이어 / 우: 루비)
      const orbGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, effectiveR);
      if (isLeft) {
        orbGrad.addColorStop(0, '#c7f9ff');
        orbGrad.addColorStop(0.3, '#00bfff');
        orbGrad.addColorStop(0.7, '#0044aa');
        orbGrad.addColorStop(1, '#05122e');
      } else {
        orbGrad.addColorStop(0, '#ffe6cc');
        orbGrad.addColorStop(0.3, '#ff4500');
        orbGrad.addColorStop(0.7, '#b30000');
        orbGrad.addColorStop(1, '#2e0505');
      }
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
      ctx.fill();

      // 4. 구체 표면 3D 하이라이트 광택
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.35, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fill();

      // 5. 답안 텍스트 렌더링
      const fontSz = Math.floor(r * 0.55);
      ctx.font = `bold ${fontSz}px 'Cinzel', 'Gowun Batang', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = isLeft ? '#00ffff' : '#ffaa00';
      ctx.shadowBlur = 12;
      ctx.fillText(text, cx, cy);

      ctx.restore();
    }

    // ==========================================
    // 3D 투시 원근 그리드 바닥 렌더러 (보스를 향해 질주하는 공간감)
    // ==========================================
    let perspectiveGridOffset = 0;
    function draw3DPerspectiveGrid(ctx, width, height, speedMultiplier) {
      const horizonY = height * 0.40;
      const floorH = height - horizonY;
      const vpX = width / 2;
      const vpY = horizonY;

      ctx.save();

      // 고대 지하 전장 심연 바닥 그라디언트
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      floorGrad.addColorStop(0, '#0c0512');
      floorGrad.addColorStop(0.3, '#190a26');
      floorGrad.addColorStop(0.7, '#240d1a');
      floorGrad.addColorStop(1, '#110408');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, width, floorH);

      // 1. 세로 원근 투시선 (소실점에서 플레이어 정면으로 방사)
      const numLongLines = 22;
      ctx.strokeStyle = isFeverTime ? 'rgba(255, 120, 0, 0.45)' : 'rgba(0, 220, 255, 0.38)';
      ctx.shadowColor = isFeverTime ? '#ff5500' : '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;

      for (let i = -numLongLines / 2; i <= numLongLines / 2; i++) {
        const spreadX = vpX + i * (width * 0.095);
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(spreadX, height);
        ctx.stroke();
      }

      // 2. 가로 쇄도 격자선 (속도에 비례해 플레이어 쪽으로 급속 쇄도)
      perspectiveGridOffset = (perspectiveGridOffset + 0.012 * speedMultiplier) % 1.0;
      const numLatLines = 14;
      for (let i = 0; i < numLatLines; i++) {
        const z = (perspectiveGridOffset + i / numLatLines) % 1.0;
        const y = vpY + floorH * Math.pow(z, 2.5);
        const alpha = Math.min(1.0, z * 1.6);
        ctx.strokeStyle = isFeverTime 
          ? `rgba(255, 160, 40, ${alpha * 0.75})` 
          : `rgba(0, 240, 255, ${alpha * 0.70})`;
        ctx.lineWidth = 1.0 + z * 3.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. 고속 질주 시 바닥 에테르 광속 스트릭
      if (speedMultiplier > 1.5) {
        ctx.strokeStyle = isFeverTime ? 'rgba(255, 230, 100, 0.5)' : 'rgba(180, 255, 255, 0.5)';
        ctx.lineWidth = 2.5;
        for (let s = 0; s < 10; s++) {
          const sz = ((perspectiveGridOffset * 2 + s * 0.1) % 1.0);
          const sy = vpY + floorH * Math.pow(sz, 2.2);
          const lane = (s - 5) * 0.18;
          const sx = vpX + lane * width * sz;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + lane * 30 * sz, sy + 35 * sz);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // ==========================================
    // 거대 보스 발밑 소환 마법진 (보스 스케일에 정렬)
    // ==========================================
    let bossCircleAngle = 0;
    function drawBossSummoningCircle(ctx, cx, cy, rx, ry) {
      ctx.save();
      ctx.translate(cx, cy);
      bossCircleAngle += 0.008;

      // 깊은 마나 광배
      const glow = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
      glow.addColorStop(0, 'rgba(255, 120, 0, 0.45)');
      glow.addColorStop(0.5, 'rgba(255, 40, 0, 0.25)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // 외곽 룬 링
      ctx.strokeStyle = 'rgba(255, 170, 40, 0.85)';
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 회전하는 8각 마법진 별
      const pts = 8;
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const a = bossCircleAngle + (i * Math.PI * 2 / pts);
        const px = Math.cos(a) * (rx * 0.72);
        const py = Math.sin(a) * (ry * 0.72);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // 룬 심볼 점
      for (let j = 0; j < pts; j++) {
        const a = -bossCircleAngle * 1.5 + (j * Math.PI * 2 / pts);
        const px = Math.cos(a) * (rx * 0.91);
        const py = Math.sin(a) * (ry * 0.91);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe082';
        ctx.fill();
      }
      ctx.restore();
    }

    // ==========================================
    // 마나 흡수 파티클 (달릴 때 주변에서 게이지로 모여듬)
    // ==========================================
    let manaGatherParticles = [];
    function updateAndDrawManaGather(ctx, targetX, targetY, isRunning) {
      if (isRunning && Math.random() < 0.65) {
        const side = Math.floor(Math.random() * 3);
        let sx, sy;
        if (side === 0) { sx = Math.random() * ctx.canvas.width; sy = -10; }
        else if (side === 1) { sx = -10; sy = Math.random() * (ctx.canvas.height * 0.8); }
        else { sx = ctx.canvas.width + 10; sy = Math.random() * (ctx.canvas.height * 0.8); }

        const angle = Math.atan2(targetY - sy, targetX - sx) + (Math.random() - 0.5) * 0.8;
        const speed = Math.random() * 7 + 5;
        manaGatherParticles.push({
          x: sx, y: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 6 + 3.5,
          color: Math.random() > 0.45 ? '#00e5ff' : '#ffd700',
          life: 0,
          maxLife: 55,
          trail: []
        });
      }

      for (let i = manaGatherParticles.length - 1; i >= 0; i--) {
        const p = manaGatherParticles[i];
        p.life++;

        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const dist = Math.hypot(dx, dy);
        const pull = Math.min(2.5, (p.life / p.maxLife) * 3.5);

        p.vx = p.vx * 0.86 + (dx / (dist + 1)) * pull * 15;
        p.vy = p.vy * 0.86 + (dy / (dist + 1)) * pull * 15;
        p.x += p.vx;
        p.y += p.vy;

        p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
        if (p.trail.length > 5) p.trail.shift();

        ctx.save();
        for (let t of p.trail) {
          t.alpha -= 0.15;
          if (t.alpha > 0) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, p.size * 0.6 * t.alpha, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.globalAlpha = t.alpha * 0.6;
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 1.0;
        ctx.fill();
        ctx.restore();

        if (dist < 30 || p.life >= p.maxLife) {
          manaGatherParticles.splice(i, 1);
        }
      }
    }

    // ==========================================
    // 미니언 러시 3D 디펜스 시스템
    // ==========================================
    let minions = [];
    let minionIdCounter = 0;
    let minionSpawnTimer = 30;

    function spawnMinion(speedBoost) {
      const lane = (Math.random() - 0.5) * 1.5;
      const speed = (Math.random() * 0.005 + 0.005) * (speedBoost || 1.0);
      minions.push({
        id: ++minionIdCounter,
        lane: lane,
        z: 0.03,
        speed: speed,
        wiggle: Math.random() * Math.PI * 2,
        state: 'running',
        slashTimer: 0,
        deathTimer: 0,
        deathType: 'fireball'
      });
    }

    function spawnMinionWave(count) {
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          spawnMinion(1.35);
        }, i * 160);
      }
    }

    function sweepAndDestroyMinions(spellType) {
      for (let m of minions) {
        if (m.state === 'running' || m.state === 'attacking') {
          m.state = 'dead';
          m.deathTimer = 22;
          m.deathType = spellType;
        }
      }
    }

    function updateAndDrawMinions(ctx, width, height) {
      const vpX = width / 2;
      const vpY = height * 0.40;
      const floorH = height * 0.86 - vpY;

      if (gameState === 'running' || gameState === 'playing') {
        minionSpawnTimer--;
        if (minionSpawnTimer <= 0) {
          spawnMinion(gameState === 'running' ? 1.4 : 1.0);
          minionSpawnTimer = Math.max(70, Math.floor(140 - questionCount * 6));
        }
      }

      for (let i = minions.length - 1; i >= 0; i--) {
        const m = minions[i];

        if (m.state === 'running') {
          m.z += m.speed;
          if (m.z >= 0.94) {
            m.state = 'attacking';
            m.slashTimer = 20;
            playerHp = Math.max(0, playerHp - 7);
            playerHurtTimer = 24;
            playSound('player_hurt');
          }
        } else if (m.state === 'attacking') {
          m.slashTimer--;
          if (m.slashTimer <= 0) {
            minions.splice(i, 1);
            continue;
          }
        } else if (m.state === 'dead') {
          m.deathTimer--;
          m.z += 0.01;
          if (m.deathTimer <= 0) {
            minions.splice(i, 1);
            continue;
          }
        }

        const my = vpY + floorH * Math.pow(m.z, 2.2);
        const mx = vpX + (m.lane * width * 0.46) * m.z;
        const ms = 14 + m.z * 62;

        ctx.save();
        ctx.translate(mx, my);

        if (m.state === 'dead') {
          const dAlpha = m.deathTimer / 22;
          ctx.globalAlpha = dAlpha;
          ctx.rotate((22 - m.deathTimer) * 0.35);
          ctx.scale(1.0 + (22 - m.deathTimer) * 0.05, 1.0 + (22 - m.deathTimer) * 0.05);
          if (m.deathType === 'frostblast') {
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00e5ff';
          } else {
            ctx.fillStyle = '#ff4400';
            ctx.shadowColor = '#ff2200';
          }
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(0, -ms * 0.3, ms * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        // 바닥 그림자
        ctx.beginPath();
        ctx.ellipse(0, 0, ms * 0.45, ms * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fill();

        // 임프 미니언 본체 (달리기 바운스)
        const bounce = Math.abs(Math.sin(Date.now() * 0.016 + m.wiggle)) * (ms * 0.22);
        ctx.translate(0, -bounce);

        // 몸통 실루엣
        ctx.beginPath();
        ctx.ellipse(0, -ms * 0.42, ms * 0.35, ms * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1c0707';
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.strokeStyle = '#881515';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 악마 뿔 (L / R)
        ctx.fillStyle = '#2d0a0a';
        ctx.beginPath();
        ctx.moveTo(-ms * 0.20, -ms * 0.65);
        ctx.quadraticCurveTo(-ms * 0.42, -ms * 1.05, -ms * 0.15, -ms * 0.95);
        ctx.lineTo(-ms * 0.08, -ms * 0.72);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(ms * 0.20, -ms * 0.65);
        ctx.quadraticCurveTo(ms * 0.42, -ms * 1.05, ms * 0.15, -ms * 0.95);
        ctx.lineTo(ms * 0.08, -ms * 0.72);
        ctx.fill();

        // 붉은 안광 눈
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(-ms * 0.12, -ms * 0.48, ms * 0.08, ms * 0.05, -0.2, 0, Math.PI * 2);
        ctx.ellipse(ms * 0.12, -ms * 0.48, ms * 0.08, ms * 0.05, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // 발톱 할퀴기 공격 이펙트 (화면 직전 슬래시)
        if (m.state === 'attacking') {
          ctx.save();
          ctx.strokeStyle = '#ff1100';
          ctx.lineWidth = Math.max(3, ms * 0.12);
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 25;
          const sProg = (20 - m.slashTimer) / 20;
          ctx.beginPath();
          ctx.moveTo(-ms * 0.8, -ms * 1.1 + sProg * ms);
          ctx.lineTo(ms * 0.8, -ms * 0.1 + sProg * ms);
          ctx.moveTo(-ms * 0.6, -ms * 1.3 + sProg * ms);
          ctx.lineTo(ms * 1.0, -ms * 0.3 + sProg * ms);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }
    }

    // ==========================================
    // 오답 시 보스 대형 화염탄 화면 직격 이펙트
    // ==========================================
    let bossAttackFireball = null;
    function updateAndDrawBossAttackFireball(ctx, width, height) {
      if (!bossAttackFireball) return;
      bossAttackFireball.progress += bossAttackFireball.speed;
      const p = bossAttackFireball.progress;

      const curX = boss.x + (width / 2 - boss.x) * p;
      const curY = boss.y + (height * 0.55 - boss.y) * p;
      const curSize = 25 + Math.pow(p, 2.5) * (Math.min(width, height) * 0.55);

      ctx.save();
      const fireGrad = ctx.createRadialGradient(curX, curY, curSize * 0.1, curX, curY, curSize);
      fireGrad.addColorStop(0, '#ffffff');
      fireGrad.addColorStop(0.2, '#ffdd44');
      fireGrad.addColorStop(0.5, '#ff4400');
      fireGrad.addColorStop(0.85, 'rgba(180, 20, 0, 0.75)');
      fireGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = fireGrad;
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(curX, curY, curSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p >= 1.0) {
        playerHp = Math.max(0, playerHp - 15);
        playerHurtTimer = 35;
        playSound('fire_explode');
        createFireImpactParticles(width / 2, height * 0.55, true);
        canvasElement.classList.remove('shake-normal', 'shake-heavy');
        void canvasElement.offsetWidth;
        canvasElement.classList.add('shake-heavy');
        bossAttackFireball = null;
      }
    }

    // ==========================================
    // 플레이어 체력(HP) 게이지 & 피격 비넷 렌더러
    // ==========================================
    let playerHp = 100;
    let playerMaxHp = 100;
    let displayPlayerHp = 100;
    let playerHurtTimer = 0;

    function drawPlayerHpBar(ctx, width, height) {
      displayPlayerHp += (playerHp - displayPlayerHp) * 0.15;
      const barW = Math.min(width * 0.20, 220);
      const barH = Math.max(20, height * 0.028);
      const barX = 24;
      const barY = height * 0.088;

      ctx.save();
      // 엔틱 프레임
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#101a14';
      ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);

      ctx.fillStyle = 'rgba(10, 30, 20, 0.9)';
      ctx.fillRect(barX, barY, barW, barH);

      // 에메랄드/루비 체력 채우기
      const fillRatio = Math.max(0, Math.min(1, displayPlayerHp / playerMaxHp));
      const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      if (fillRatio > 0.4) {
        hpGrad.addColorStop(0, '#7bf1a8');
        hpGrad.addColorStop(0.5, '#10b981');
        hpGrad.addColorStop(1, '#047857');
      } else {
        hpGrad.addColorStop(0, '#f87171');
        hpGrad.addColorStop(0.5, '#ef4444');
        hpGrad.addColorStop(1, '#991b1b');
      }
      ctx.fillStyle = hpGrad;
      ctx.fillRect(barX, barY, barW * fillRatio, barH);

      // 테두리
      ctx.strokeStyle = playerHurtTimer > 0 ? '#ff3333' : '#34d399';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(barX, barY, barW, barH);

      // 텍스트 표기
      ctx.font = `bold ${Math.floor(barH * 0.65)}px 'Cinzel', 'Gowun Batang', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(`기사단 HP: ${Math.ceil(playerHp)} / ${playerMaxHp}`, barX + barW / 2, barY + barH / 2);

      ctx.restore();

      // 플레이어 체력 소진 시 결계의 가호 회복
      if (playerHp <= 0) {
        playerHp = 40;
        playerHurtTimer = 25;
        playSound('magic_frost');
      }
    }

    function drawPlayerHurtVignette(ctx, width, height) {
      if (playerHurtTimer <= 0) return;
      playerHurtTimer--;
      ctx.save();
      const vAlpha = Math.min(0.70, (playerHurtTimer / 25) * 0.70);
      const vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.75);
      vig.addColorStop(0, 'rgba(255, 0, 0, 0)');
      vig.addColorStop(0.7, `rgba(255, 20, 0, ${vAlpha * 0.4})`);
      vig.addColorStop(1, `rgba(200, 0, 0, ${vAlpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // ==========================================
    // 연금술 마나 플라스크 게이지 (달리기 충전 바)
    // ==========================================
    function drawManaFlaskGauge(ctx, barX, barY, barWidth, barHeight, fillRatio, runMultiplier) {
      ctx.save();
      const capW = 22;

      // 플라스크 외곽 그림자
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 14;

      // 유리 플라스크 배경
      ctx.fillStyle = 'rgba(10, 20, 25, 0.85)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // 차오르는 마나 액체 (피버/패널티 시 주황/빨강, 일반 시 에메랄드/시안)
      const liquidGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
      if (runMultiplier > 1.0) {
        liquidGrad.addColorStop(0, '#ffcc00');
        liquidGrad.addColorStop(0.5, '#ff4500');
        liquidGrad.addColorStop(1, '#990000');
      } else {
        liquidGrad.addColorStop(0, '#b3fffc');
        liquidGrad.addColorStop(0.5, '#00e5ff');
        liquidGrad.addColorStop(1, '#0066aa');
      }
      ctx.fillStyle = liquidGrad;
      ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);

      // 기포 거품 연출
      for (let b = 0; b < 6; b++) {
        const bubbleX = barX + (barWidth * fillRatio) * ((b * 0.17 + Date.now() / 800) % 1.0);
        const bubbleY = barY + barHeight * 0.3 + Math.sin(Date.now() / 200 + b) * (barHeight * 0.25);
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
      }

      // 유리관 반사광
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(barX, barY, barWidth, barHeight * 0.3);

      // 황금 캡 (좌/우 엔틱 마운트)
      const capGrad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      capGrad.addColorStop(0, '#fff4b8');
      capGrad.addColorStop(0.5, '#d4af37');
      capGrad.addColorStop(1, '#5c3a00');
      ctx.fillStyle = capGrad;
      ctx.fillRect(barX - capW, barY - 4, capW, barHeight + 8);
      ctx.fillRect(barX + barWidth, barY - 4, capW, barHeight + 8);

      // 황금 테두리
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      ctx.restore();
    }

    // ==========================================
    // 손바닥 중심 및 손 크기 추정 (MediaPipe Pose 기반)
    // ==========================================
    function getPalm(landmarks, isLeft, width, height) {
      if (!landmarks) return null;
      const wIdx = isLeft ? 15 : 16;
      const pIdx = isLeft ? 17 : 18;
      const iIdx = isLeft ? 19 : 20;
      const eIdx = isLeft ? 13 : 14;

      const w = landmarks[wIdx];
      if (!w || w.visibility < 0.35) return null;

      const p = landmarks[pIdx];
      const idx = landmarks[iIdx];
      const e = landmarks[eIdx];

      let rx = w.x, ry = w.y;
      let handSpan = 0;

      if (idx && idx.visibility > 0.3 && p && p.visibility > 0.3) {
        rx = w.x * 0.35 + idx.x * 0.35 + p.x * 0.30;
        ry = w.y * 0.35 + idx.y * 0.35 + p.y * 0.30;
        handSpan = Math.hypot(w.x - idx.x, w.y - idx.y);
      } else if (idx && idx.visibility > 0.3) {
        rx = w.x * 0.45 + idx.x * 0.55;
        ry = w.y * 0.45 + idx.y * 0.55;
        handSpan = Math.hypot(w.x - idx.x, w.y - idx.y);
      } else if (e && e.visibility > 0.35) {
        const dx = w.x - e.x;
        const dy = w.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01) {
          rx = w.x + (dx / d) * (d * 0.25);
          ry = w.y + (dy / d) * (d * 0.25);
          handSpan = d * 0.38;
        }
      }

      const px = (1.0 - rx) * width;
      const py = ry * height;
      const baseHandSize = handSpan > 0.02 ? handSpan * Math.min(width, height) * 1.85 : height * 0.09;
      const size = Math.max(48, Math.min(145, baseHandSize));

      return { x: px, y: py, size, visibility: w.visibility };
    }

    // ==========================================
    // 원소 마법 지팡이 렌더러 (오른손: 불 지팡이, 왼손: 냉기 지팡이)
    // ==========================================
    function drawElementalStaff(ctx, palm, isRightHand) {
      if (!palm) return;
      const { x, y, size } = palm;
      const staffLen = size * 1.35;
      const headRadius = size * 0.23;

      ctx.save();
      ctx.translate(x, y);

      const angle = isRightHand ? -Math.PI * 0.16 : Math.PI * 0.16;
      ctx.rotate(angle);

      // 1. 지팡이 샤프트 (Staff Shaft)
      const shaftW = Math.max(5, size * 0.08);
      const shaftGrad = ctx.createLinearGradient(-shaftW/2, 0, shaftW/2, staffLen);
      if (isRightHand) {
        // 불 지팡이: 흑요석 및 황금 룬 자루
        shaftGrad.addColorStop(0, '#ffd700');
        shaftGrad.addColorStop(0.3, '#7c2d12');
        shaftGrad.addColorStop(0.7, '#261005');
        shaftGrad.addColorStop(1, '#ffd700');
      } else {
        // 냉기 지팡이: 미스릴 실버 및 아주르 빙결 자루
        shaftGrad.addColorStop(0, '#ffffff');
        shaftGrad.addColorStop(0.3, '#38bdf8');
        shaftGrad.addColorStop(0.7, '#0c4a6e');
        shaftGrad.addColorStop(1, '#bae6fd');
      }

      ctx.fillStyle = shaftGrad;
      ctx.strokeStyle = isRightHand ? '#ffd700' : '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-shaftW / 2, -headRadius * 0.5, shaftW, staffLen, 4);
      ctx.fill();
      ctx.stroke();

      // 2. 지팡이 헤드 마운트 (드래곤 클로 / 아케인 아크)
      ctx.save();
      ctx.strokeStyle = isRightHand ? '#ffd700' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = isRightHand ? '#ff6600' : '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -headRadius * 1.15, headRadius * 1.15, 0.3 * Math.PI, 0.7 * Math.PI, true);
      ctx.stroke();
      ctx.restore();

      // 3. 지팡이 헤드 원소 보석 (불 오브 vs 냉기 크리스탈)
      const orbY = -headRadius * 1.25;
      const orbR = headRadius * 0.95;

      const auraGrad = ctx.createRadialGradient(0, orbY, orbR * 0.2, 0, orbY, orbR * 2.2);
      if (isRightHand) {
        auraGrad.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
        auraGrad.addColorStop(0.3, 'rgba(255, 100, 0, 0.7)');
        auraGrad.addColorStop(0.7, 'rgba(220, 30, 0, 0.3)');
        auraGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      } else {
        auraGrad.addColorStop(0, 'rgba(240, 255, 255, 0.95)');
        auraGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.7)');
        auraGrad.addColorStop(0.7, 'rgba(2, 132, 199, 0.3)');
        auraGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
      }
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, orbY, orbR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 코어 구체
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, orbY, orbR, 0, Math.PI * 2);
      ctx.fillStyle = isRightHand ? '#ff3300' : '#0284c7';
      ctx.shadowColor = isRightHand ? '#ff8800' : '#38bdf8';
      ctx.shadowBlur = 20;
      ctx.fill();

      // 내부 하이라이트
      ctx.beginPath();
      ctx.arc(-orbR * 0.3, orbY - orbR * 0.3, orbR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // 4. 원소 효과: 불꽃 날름거림 (오른손) or 회전 다이아몬드 얼음 결정 (왼손)
      const time = Date.now() * 0.005;
      if (isRightHand) {
        for (let f = 0; f < 4; f++) {
          const fAng = time * 2 + f * (Math.PI / 2);
          const fx = Math.cos(fAng) * (orbR * 0.65);
          const fy = orbY - orbR - (Math.sin(time * 3 + f) * 0.5 + 0.5) * (orbR * 1.1);
          ctx.save();
          ctx.beginPath();
          ctx.arc(fx, fy, orbR * 0.32, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 220, 50, 0.85)';
          ctx.shadowColor = '#ff3300';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();
        }
      } else {
        for (let c = 0; c < 3; c++) {
          const cAng = -time * 2 + c * (Math.PI * 2 / 3);
          const cx = Math.cos(cAng) * (orbR * 1.15);
          const cy = orbY + Math.sin(cAng) * (orbR * 1.15);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(time * 3 + c);
          ctx.beginPath();
          ctx.moveTo(0, -orbR * 0.35);
          ctx.lineTo(orbR * 0.25, 0);
          ctx.lineTo(0, orbR * 0.35);
          ctx.lineTo(-orbR * 0.25, 0);
          ctx.closePath();
          ctx.fillStyle = '#e0f2fe';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      }

      // 지팡이 라벨
      ctx.save();
      ctx.font = `bold ${Math.max(12, Math.floor(size * 0.16))}px 'Cinzel', 'Gowun Batang', serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isRightHand ? '#ffe082' : '#bae6fd';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 5;
      ctx.fillText(isRightHand ? "불 지팡이" : "냉기 지팡이", 0, staffLen + 16);
      ctx.restore();

      ctx.restore();
    }

    // ==========================================
    // 커서 및 지팡이 렌더링
    // ==========================================
    let leftCursorTrail = [];
    let rightCursorTrail = [];
    function renderCursors(results, ctx, width, height) {
      if (!results.poseLandmarks) return;
      const leftPalm = getPalm(results.poseLandmarks, true, width, height);
      const rightPalm = getPalm(results.poseLandmarks, false, width, height);

      const updateTrail = (palm, trailArr, colorFn) => {
        if (!palm) return;
        trailArr.push({ x: palm.x, y: palm.y, life: 1.0, size: palm.size * 0.3 });
        if (trailArr.length > 10) trailArr.shift();
        for (let i = 0; i < trailArr.length; i++) {
          let t = trailArr[i];
          t.life -= 0.09;
          if (t.life <= 0) continue;
          ctx.save();
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.size * t.life, 0, Math.PI * 2);
          ctx.fillStyle = colorFn(t.life);
          ctx.shadowColor = colorFn(1.0);
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      };

      updateTrail(leftPalm, leftCursorTrail, (a) => `rgba(0, 220, 255, ${a * 0.4})`);
      updateTrail(rightPalm, rightCursorTrail, (a) => `rgba(255, 140, 0, ${a * 0.4})`);

      if (leftPalm) drawElementalStaff(ctx, leftPalm, false); // 왼손: 냉기 지팡이
      if (rightPalm) drawElementalStaff(ctx, rightPalm, true);  // 오른손: 불 지팡이
    }

    // 도형 그리기 함수 (문제에서 shape 데이터가 있을 경우)
    function drawShapeData(ctx, shapeObj) {
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
        // 3배 확대로 인해 선 굵기가 같이 커지므로 기본 굵기를 2로 조정
        ctx.lineWidth = 2;
        // 텍스트(알파벳 베이스라인 위로 올라옴)와 겹치지 않도록 높이에 비례하여 위로 띄움
        let offset = Math.max(180, (window.innerHeight || 800) * 0.25);
        ctx.translate(0, -offset); 
        ctx.scale(3, 3); 
        
        if (shapeObj.type === 'rect') {
            ctx.strokeRect(-60, -40, 120, 80);
            ctx.fillRect(-60, -40, 120, 80);
            ctx.fillStyle = 'yellow'; ctx.font = '24px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, 0, 60); 
            if (shapeObj.h) ctx.fillText(shapeObj.h, 80, 0); 
        } else if (shapeObj.type === 'square') {
            let s = 45;
            ctx.strokeRect(-s, -s, s*2, s*2);
            ctx.fillRect(-s, -s, s*2, s*2);
            ctx.fillStyle = 'yellow'; ctx.font = '22px sans-serif';
            if (shapeObj.w) {
              ctx.fillText(shapeObj.w, 0, s + 25);
              ctx.fillText(shapeObj.w, s + 20, 0);
            }
        } else if (shapeObj.type === 'triangle') {
            ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(-50, 40); ctx.lineTo(50, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '24px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, 0, 60); 
            if (shapeObj.h) ctx.fillText(shapeObj.h, 30, -10); 
        } else if (shapeObj.type === 'equilateral_triangle') {
            ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(-50, 40); ctx.lineTo(50, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '22px sans-serif';
            if (shapeObj.w) {
              ctx.fillText(shapeObj.w, 0, 65);
              ctx.fillText(shapeObj.w, -40, -10);
              ctx.fillText(shapeObj.w, 40, -10);
            }
        } else if (shapeObj.type === 'isosceles_triangle') {
            ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(-45, 40); ctx.lineTo(45, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '22px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, 0, 65);
            if (shapeObj.a) {
              ctx.fillText(shapeObj.a, -40, -15);
              ctx.fillText(shapeObj.a, 40, -15);
            }
        } else if (shapeObj.type === 'parallelogram') {
            ctx.beginPath(); ctx.moveTo(-30, -35); ctx.lineTo(60, -35); ctx.lineTo(30, 35); ctx.lineTo(-60, 35); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '22px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, -15, 60);
            if (shapeObj.h) ctx.fillText(shapeObj.h, 60, 0);
        } else if (shapeObj.type === 'trapezoid') {
            ctx.beginPath(); ctx.moveTo(-35, -35); ctx.lineTo(35, -35); ctx.lineTo(65, 35); ctx.lineTo(-65, 35); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
            if (shapeObj.a) ctx.fillText(shapeObj.a, 0, -45);
            if (shapeObj.b) ctx.fillText(shapeObj.b, 0, 60);
            if (shapeObj.h) ctx.fillText('h=' + shapeObj.h, 70, 0);
        } else if (shapeObj.type === 'circle') {
            ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI*2);
            ctx.stroke(); ctx.fill();
            if (shapeObj.r) {
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(45, 0); ctx.stroke();
              ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
              ctx.fillText('r=' + shapeObj.r, 22, -10);
            }
        } else if (shapeObj.type === 'pentagon') {
            ctx.beginPath();
            for(let i=0; i<5; i++) {
              let ang = -Math.PI/2 + (i * Math.PI * 2 / 5);
              let px = Math.cos(ang) * 50, py = Math.sin(ang) * 50;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke(); ctx.fill();
        } else if (shapeObj.type === 'hexagon') {
            ctx.beginPath();
            for(let i=0; i<6; i++) {
              let ang = (i * Math.PI / 3);
              let px = Math.cos(ang) * 50, py = Math.sin(ang) * 50;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke(); ctx.fill();
        } else if (shapeObj.type === 'cube') {
            let s = 40;
            ctx.beginPath();
            ctx.rect(-s, -s, s*2, s*2); 
            ctx.moveTo(-s, -s); ctx.lineTo(-s+20, -s-20); ctx.lineTo(s+20, -s-20); ctx.lineTo(s, -s);
            ctx.moveTo(s+20, -s-20); ctx.lineTo(s+20, s-20); ctx.lineTo(s, s);
            ctx.stroke();
            ctx.fillStyle = 'yellow'; ctx.font = '24px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, 0, s + 25);
        } else if (shapeObj.type === 'cuboid') {
            let sx = 50, sy = 30, sz = 25;
            ctx.beginPath();
            ctx.rect(-sx, -sy, sx*2, sy*2);
            ctx.moveTo(-sx, -sy); ctx.lineTo(-sx+sz, -sy-sz); ctx.lineTo(sx+sz, -sy-sz); ctx.lineTo(sx, -sy);
            ctx.moveTo(sx+sz, -sy-sz); ctx.lineTo(sx+sz, sy-sz); ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
            if (shapeObj.w) ctx.fillText(shapeObj.w, 0, sy + 22);
            if (shapeObj.h) ctx.fillText(shapeObj.h, sx + 22, 0);
            if (shapeObj.d) ctx.fillText(shapeObj.d, sx/2 + sz, -sy/2 - sz);
        } else if (shapeObj.type === 'triangle_angle') {
            ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(-65, 40); ctx.lineTo(65, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
            ctx.fillText(shapeObj.a + '°', -40, 30);
            ctx.fillText(shapeObj.b + '°', 40, 30);
            ctx.fillStyle = '#FF5555';
            ctx.fillText('?°', 0, -25);
        } else if (shapeObj.type === 'right_triangle_angle') {
            ctx.beginPath(); ctx.moveTo(-50, -50); ctx.lineTo(-50, 40); ctx.lineTo(50, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-50, 25); ctx.lineTo(-35, 25); ctx.lineTo(-35, 40); ctx.stroke();
            ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
            ctx.fillText(shapeObj.a + '°', 25, 28);
            ctx.fillStyle = '#FF5555';
            ctx.fillText('?°', -30, -30);
        } else if (shapeObj.type === 'isosceles_angle') {
            ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(-55, 40); ctx.lineTo(55, 40); ctx.closePath();
            ctx.stroke(); ctx.fill();
            ctx.fillStyle = 'yellow'; ctx.font = '20px sans-serif';
            ctx.fillText(shapeObj.a + '°', 0, -35);
            ctx.fillStyle = '#FF5555';
            ctx.fillText('?°', -35, 30);
            ctx.fillText('?°', 35, 30);
        } else if (shapeObj.type === 'stack_cubes') {
            const grid = shapeObj.grid || [[1,1],[1,0]];
            const numR = grid.length;
            const numC = grid[0].length;
            const sz = (numR > 2 || numC > 2) ? 23 : 28;
            const cos30 = Math.cos(Math.PI / 6);
            const sin30 = Math.sin(Math.PI / 6);
            ctx.translate(0, 20);
            ctx.lineWidth = 2;
            
            const midC_minus_R = ((numC - 1) - (numR - 1)) / 2;
            const baseR_plus_C = ((numC - 1) + (numR - 1)) / 2 - 1.0;

            const cells = [];
            for (let r = 0; r < numR; r++) {
              for (let c = 0; c < numC; c++) {
                if (grid[r][c] > 0) cells.push({ r, c, count: grid[r][c] });
              }
            }
            cells.sort((a, b) => (a.r + a.c) - (b.r + b.c));

            for (let cell of cells) {
              const { r, c, count } = cell;
              for (let z = 0; z < count; z++) {
                let bx = (c - r - midC_minus_R) * (sz * cos30);
                let by = ((c + r) - baseR_plus_C) * (sz * sin30) - z * sz;

                // 윗면 (Top)
                ctx.fillStyle = '#4FC3F7';
                ctx.beginPath();
                ctx.moveTo(bx, by - sz * sin30);
                ctx.lineTo(bx + sz * cos30, by);
                ctx.lineTo(bx, by + sz * sin30);
                ctx.lineTo(bx - sz * cos30, by);
                ctx.closePath();
                ctx.fill(); ctx.stroke();

                // 좌측면 (Left)
                ctx.fillStyle = '#0288D1';
                ctx.beginPath();
                ctx.moveTo(bx - sz * cos30, by);
                ctx.lineTo(bx, by + sz * sin30);
                ctx.lineTo(bx, by + sz * sin30 + sz);
                ctx.lineTo(bx - sz * cos30, by + sz);
                ctx.closePath();
                ctx.fill(); ctx.stroke();

                // 우측면 (Right)
                ctx.fillStyle = '#01579B';
                ctx.beginPath();
                ctx.moveTo(bx, by + sz * sin30);
                ctx.lineTo(bx + sz * cos30, by);
                ctx.lineTo(bx + sz * cos30, by + sz);
                ctx.lineTo(bx, by + sz * sin30 + sz);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
              }
            }
            if (shapeObj.view === 'top') {
              ctx.fillStyle = '#FFEB3B'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
              ctx.fillText('↓ [위에서 내려다본 모습]', 0, -60);
            } else if (shapeObj.view === 'front') {
              ctx.fillStyle = '#FFEB3B'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
              ctx.fillText('↑ [정면에서 본 모습]', 0, 75);
            } else if (shapeObj.view === 'side') {
              ctx.fillStyle = '#FFEB3B'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
              const sideX = numC > 2 ? 95 : 85;
              ctx.fillText('→ [우측에서 본 모습]', sideX, 0);
            }
        } else if (shapeObj.type === 'cube_net') {
            const sz = 24;
            const layout = shapeObj.layout || [
              { r: 0, c: 1, val: shapeObj.faces ? shapeObj.faces[0] : 2 },
              { r: 1, c: 0, val: shapeObj.faces ? shapeObj.faces[1] : 4 },
              { r: 1, c: 1, val: shapeObj.faces ? shapeObj.faces[2] : 1 },
              { r: 1, c: 2, val: shapeObj.faces ? shapeObj.faces[3] : 3 },
              { r: 2, c: 1, val: shapeObj.faces ? shapeObj.faces[4] : 5 },
              { r: 3, c: 1, val: shapeObj.faces ? shapeObj.faces[5] : 6 }
            ];
            ctx.translate(-sz * 1.5, -sz * 1.5);
            for (let cell of layout) {
              let cx = cell.c * sz;
              let cy = cell.r * sz;
              ctx.fillStyle = (cell.val === shapeObj.face) ? '#FFCC00' : 'rgba(0, 200, 255, 0.4)';
              ctx.fillRect(cx, cy, sz, sz);
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 2;
              ctx.strokeRect(cx, cy, sz, sz);
              ctx.fillStyle = (cell.val === shapeObj.face) ? '#000' : '#FFF';
              ctx.font = 'bold 16px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(cell.val, cx + sz/2, cy + sz/2);
            }
            if (shapeObj.points) {
              ctx.fillStyle = '#FF5252';
              ctx.font = 'bold 16px sans-serif';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              for (let pt of shapeObj.points) {
                ctx.fillText(pt.t, pt.c * sz, pt.r * sz);
              }
            }
        } else if (shapeObj.type === 'arrow_rot') {
            ctx.fillStyle = 'yellow';
            ctx.font = 'bold 50px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(shapeObj.from || '→', -55, 0);
            
            ctx.fillStyle = '#00FF00';
            ctx.font = 'bold 19px sans-serif';
            let dirText = shapeObj.deg > 0 ? `⟳ 시계 ${shapeObj.deg}°` : `⟲ 반시계 ${Math.abs(shapeObj.deg)}°`;
            ctx.fillText(dirText, 40, -25);
            ctx.fillStyle = '#FF5555';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('➔  [ ? ]', 40, 15);
        }
        ctx.restore();
    }

    // ==========================================
    // 기본 타이틀 및 난이도 정의 (5글자 이내 제한 보장)
    // ==========================================
    const LEVEL_SHORT_MAP = {
      '1': '덧뺄셈',
      '2': '곱나눗셈',
      '3': '분수',
      '4': '소수',
      '5': '제곱',
      '6': '2진수',
      '7': '도형',
      '8': '비율',
      '9': '기타'
    };

    const SUB_SHORT_MAP = {
      '1-1': '한자리', '1-2': '두자리', '1-3': '혼합 1', '1-4': '혼합 2', '1-5': '크기비교', '1-6': '복합비교', '1-7': '빈칸역산',
      '2-1': '한자리', '2-2': '단위곱', '2-3': '두자리', '2-4': '호환수', '2-5': '복합곱',
      '3-1': '비교 1', '3-2': '비교 2', '3-3': '덧뺄셈 1', '3-4': '덧뺄셈 2', '3-5': '곱나눗셈',
      '4-1': '크기비교', '4-2': '덧뺄셈', '4-3': '분수변환', '4-4': '곱나눗셈', '4-5': '응용문제',
      '5-1': '기본제곱', '5-2': '제곱 1', '5-3': '제곱 2', '5-4': '루트(√)', '5-5': '응용문제',
      '6-1': '10진변환', '6-2': '2진변환', '6-3': '2진덧셈', '6-4': '2진뺄셈', '6-5': '곱·비교',
      '7-1': '도형구분', '7-2': '둘레구하기', '7-3': '넓이구하기', '7-4': '부피구하기', '7-5': '각도구하기',
      '8-1': '단순비교', '8-2': '비율계산', '8-3': '소수비율',
      '9-1': '시그마', '9-2': '방정식', '9-3': '팩토리얼', '9-4': '쌓기나무', '9-5': '회전전개', '9-6': '규칙찾기', '9-7': '수배열'
    };

    function formatLevelTitle(lvl, rawTitle) {
      if (LEVEL_SHORT_MAP[String(lvl)]) return LEVEL_SHORT_MAP[String(lvl)];
      if (rawTitle) {
        let cleaned = String(rawTitle).replace(/^\d+[\.\-\s]*/, '').trim();
        if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
        if (cleaned.length > 0) return cleaned;
      }
      return `${lvl}단계`;
    }

    function formatSubTitle(lvl, sub, rawTitle) {
      const key = `${lvl}-${sub}`;
      if (SUB_SHORT_MAP[key]) return SUB_SHORT_MAP[key];
      if (rawTitle) {
        let cleaned = String(rawTitle).replace(/^\d+[\-\.]\d+[\.\-\s]*/, '').trim();
        if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
        if (cleaned.length > 0) return cleaned;
      }
      return `${lvl}-${sub}`;
    }

    const LEVEL_TITLES = ["덧뺄셈", "곱나눗셈", "분수", "소수", "제곱", "2진수", "도형", "비율", "기타"];
    const SUB_TITLES = [
      ["한자리", "두자리", "혼합 1", "혼합 2", "크기비교", "복합비교", "빈칸역산"],
      ["한자리", "단위곱", "두자리", "호환수", "복합곱"],
      ["비교 1", "비교 2", "덧뺄셈 1", "덧뺄셈 2", "곱나눗셈"],
      ["크기비교", "덧뺄셈", "분수변환", "곱나눗셈", "응용문제"],
      ["기본제곱", "제곱 1", "제곱 2", "루트(√)", "응용문제"],
      ["10진변환", "2진변환", "2진덧셈", "2진뺄셈", "곱·비교"],
      ["도형구분", "둘레구하기", "넓이구하기", "부피구하기", "각도구하기"],
      ["단순비교", "비율계산", "소수비율"],
      ["시그마", "방정식", "팩토리얼", "쌓기나무", "회전전개", "규칙찾기", "수배열"]
    ];

    let dynamicLevels = [];

    function getLevelTitle(lvl) {
      const found = dynamicLevels.find(l => l.id === lvl);
      return formatLevelTitle(lvl, found ? found.title : null);
    }

    function getSubTitle(lvl, sub) {
      const found = dynamicLevels.find(l => l.id === lvl);
      let raw = null;
      if (found) {
        const subFound = found.subLevels.find(s => s.id === sub);
        if (subFound) raw = subFound.title;
      }
      return formatSubTitle(lvl, sub, raw);
    }

    // ==========================================
    // 게임 로직
    // ==========================================
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output_canvas');
    const canvasCtx = canvasElement.getContext('2d');
    const loadingText = document.getElementById('loading');

    function resizeCanvas() {
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); 

    // 테스트용 스페이스바 에너지바 충전 기능
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (gameState === 'running') {
          runGauge += targetRunGauge * 0.15; // 스페이스 한 번당 15% 충전
          // onResults에서 매 프레임 -0.3씩 감소하므로, 
          // 정확히 targetRunGauge에 맞추면 바로 다음 프레임에 깎여서 100%를 못 넘깁니다.
          // 따라서 감소량을 이겨내도록 +1을 여유로 줍니다.
          if (runGauge >= targetRunGauge) runGauge = targetRunGauge + 1;
        }
      }
    });

    let gameState = "menu_main"; 
    let previousGameState = "running";
    
    let currentLevel = 1;
    let currentSubLevel = 1;
    let questionCount = 0;
    const MAX_QUESTIONS_PER_LEVEL = 10; 

    let score = 0;
    let startTime = 0;
    let endTime = 0;
    let stateTimer = 0;
    let totalWrongCount = 0;

    let questionText = "";
    let questionShape = null; 
    let leftAnswerText = "";
    let rightAnswerText = "";
    let correctSide = "left"; 

    let leftBoxRequiredHand = "left"; 
    let rightBoxRequiredHand = "right";
    let isCrossMode = false;

    let prevLeftOccupied = false;
    let prevRightOccupied = false;

    let runGauge = 0;
    let runMultiplier = 1.0; 
    let targetRunGauge = 100; 
    let baseShoulderY = 0;
    let isStepUp = false;
    
    let smoothedLeftShoulderX = window.innerWidth * 0.3;
    let smoothedRightShoulderX = window.innerWidth * 0.7;
    let smoothedShoulderY = window.innerHeight * 0.4;
    
    let combo = 0;
    let lastHitSide = "left";

    let menuBoxes = [];
    let previousQuestions = [];
    let lastPlayedLevel = -1;
    let lastPlayedSubLevel = -1;
    let currentRoundTemplates = [];
    
    function initMenuMain() {
      gameState = "menu_main";
      menuBoxes = [];
      const w = canvasElement.width || window.innerWidth;
      const h = canvasElement.height || window.innerHeight;
      const total = dynamicLevels.length > 0 ? dynamicLevels.length : 8;
      const r = Math.min(h * 0.088, w * 0.075);
      const centerX = w / 2;
      const centerY = h * 0.55;
      const radiusX = w * 0.33;
      const radiusY = h * 0.28;
      
      for(let i=0; i<total; i++) {
        let angle = -Math.PI/2 + (2 * Math.PI * (i / total));
        let cx = centerX + Math.cos(angle) * radiusX;
        let cy = centerY + Math.sin(angle) * radiusY;
        let text = dynamicLevels[i] ? dynamicLevels[i].title : (LEVEL_TITLES[i] || `${i+1}단계`);
        let id = dynamicLevels[i] ? dynamicLevels[i].id : i+1;
        menuBoxes.push({ id, text, cx, cy, r, progress: 0, hovered: false, flash: 0 });
      }
      bgmEnabled = false;
      stopBGM();
    }

    function initMenuSub(levelId) {
      currentLevel = levelId;
      gameState = "menu_sub";
      menuBoxes = [];
      const w = canvasElement.width || window.innerWidth;
      const h = canvasElement.height || window.innerHeight;
      
      const levelData = dynamicLevels.find(l => l.id === levelId);
      const subList = levelData ? levelData.subLevels : (SUB_TITLES[levelId-1] ? SUB_TITLES[levelId-1].map((t, idx) => ({ id: idx+1, title: t })) : []);
      
      const count = subList.length;
      const totalItems = count + 1;
      
      // 항목 수에 따라 반지름을 적절히 조절해 겹침 방지
      const r = totalItems >= 8 ? Math.min(h * 0.080, w * 0.070) : Math.min(h * 0.088, w * 0.075);
      
      const centerX = w / 2;
      const centerY = h * 0.55;
      const radiusX = w * 0.33;
      const radiusY = h * 0.28;
      
      for(let i=0; i<count; i++) {
        let angle = -Math.PI/2 + (2 * Math.PI * (i / count)); // count만으로 완벽한 균등 분배
        let cx = centerX + Math.cos(angle) * radiusX;
        let cy = centerY + Math.sin(angle) * radiusY;
        menuBoxes.push({ id: subList[i].id, text: subList[i].title, cx, cy, r, progress: 0, hovered: false, flash: 0 });
      }
      
      // '뒤로가기'는 우측 하단 고정
      let backR = Math.min(h * 0.075, w * 0.065);
      let backCx = w * 0.88;
      let backCy = h * 0.88;
      menuBoxes.push({ id: "back", text: "« 뒤로", cx: backCx, cy: backCy, r: backR, progress: 0, hovered: false, flash: 0 });
    }

    initMenuMain();

    let playingCooldownUntil = 0;

    function startGame(subLevelId) {
      currentSubLevel = subLevelId;
      questionCount = 0;
      score = 0;
      combo = 0;
      runGauge = 0;
      runMultiplier = 1.0;
      targetRunGauge = 100;
      totalWrongCount = 0;
      playingCooldownUntil = 0;
      playerHp = 100;
      playerMaxHp = 100;
      displayPlayerHp = 100;
      playerHurtTimer = 0;
      minions = [];
      minionSpawnTimer = 35;
      manaGatherParticles = [];
      bossAttackFireball = null;
      currentRoundTemplates = [];
      boss.reset(MAX_QUESTIONS_PER_LEVEL);
      questionShatterParticles = [];
      questionFizzleParticles = [];
      spellProjectiles = [];
      if (lastPlayedLevel !== currentLevel || lastPlayedSubLevel !== subLevelId) {
        previousQuestions = [];
        lastPlayedLevel = currentLevel;
        lastPlayedSubLevel = subLevelId;
      }
      startTime = Date.now();
      generateQuestion(); 
      gameState = "running";
      isFeverTime = false;
      startBGM();
    }

    function drawGridAndSpeedLines(ctx, width, height, speedMultiplier) {
      draw3DPerspectiveGrid(ctx, width, height, speedMultiplier);
    }

    function parseCsvLine(line) {
        const row = [];
        let inQuotes = false;
        let token = "";
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i+1] === '"') {
                    token += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(token.trim());
                token = "";
            } else {
                token += char;
            }
        }
        row.push(token.trim());
        return row;
    }

    let questionDB = [];
    fetch('questions.csv?t=' + new Date().getTime()).then(res => res.text()).then(text => {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) return;

        const headerCols = parseCsvLine(lines[0]);
        const hasTitles = headerCols.includes("LevelTitle");
        
        const lvlMap = new Map();
        questionDB = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cleanCols = parseCsvLine(lines[i]);
            if (cleanCols.length < 5) continue;
            
            let lvl, sub, lvlTitle, subTitle, qTemp, cTemp, wTemp, va, vb, vc, vd, shape;
            if (hasTitles) {
                lvl = parseInt(cleanCols[0]);
                sub = parseInt(cleanCols[1]);
                lvlTitle = formatLevelTitle(lvl, cleanCols[2]);
                subTitle = formatSubTitle(lvl, sub, cleanCols[3]);
                qTemp = cleanCols[4];
                cTemp = cleanCols[5];
                wTemp = cleanCols[6];
                va = cleanCols[7];
                vb = cleanCols[8];
                vc = cleanCols[9];
                vd = cleanCols[10] || "0";
                shape = cleanCols[11] || "";
            } else {
                lvl = parseInt(cleanCols[0]);
                sub = parseInt(cleanCols[1]);
                lvlTitle = formatLevelTitle(lvl, null);
                subTitle = formatSubTitle(lvl, sub, null);
                qTemp = cleanCols[2];
                cTemp = cleanCols[3];
                wTemp = cleanCols[4];
                va = cleanCols[5];
                vb = cleanCols[6];
                vc = cleanCols[7];
                vd = "0";
                shape = cleanCols[8] || "";
            }
            
            questionDB.push({ level: lvl, subLevel: sub, qTemp, cTemp, wTemp, va, vb, vc, vd, shape });
            
            if (!lvlMap.has(lvl)) {
                lvlMap.set(lvl, { id: lvl, title: lvlTitle, subLevels: [] });
            }
            const lObj = lvlMap.get(lvl);
            if (!lObj.subLevels.some(s => s.id === sub)) {
                lObj.subLevels.push({ id: sub, title: subTitle });
            }
        }
        
        dynamicLevels = Array.from(lvlMap.values()).sort((a, b) => a.id - b.id);
        dynamicLevels.forEach(l => l.subLevels.sort((a, b) => a.id - b.id));
        
        if (gameState === "menu_main") initMenuMain();
        else if (gameState === "menu_sub") initMenuSub(currentLevel);
    }).catch(e => console.error("CSV loading error:", e));

    function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function pick(...args) { 
       if (Array.isArray(args[0])) return args[0][rand(0, args[0].length - 1)];
       return args[rand(0, args.length - 1)]; 
    }
    function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
    function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
    function sup(n) {
      const sups = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
      return String(n).split('').map(d => sups[d] || d).join('');
    }
    function repeatMul(num, count) {
      return Array(Math.max(1, count)).fill(num).join(' × ');
    }
    function repeatAdd(num, count) {
      return Array(Math.max(1, count)).fill(num).join(' + ');
    }
    
    // 긴 문제가 화면을 벗어나지 않도록 의미 단위 및 어절 균형을 고려하여 보기 좋게 줄바꿈
    function splitQuestionText(ctx, text, maxWidth) {
      if (!text) return [""];
      if (ctx.measureText(text).width <= maxWidth) {
        return [text];
      }

      // 1. 구두점, 괄호, 콜론, 조사 등 자연스러운 의미 구분자를 우선 검색
      const delimiters = [
        /(?<=\?|\!)\s+/,
        /(?<=\]|\))\s+/,
        /(?<=:)\s+/,
        /(?<=,)\s+/,
        /(?<=(?:과|와|때|면))\s+/
      ];

      for (let delim of delimiters) {
        const parts = text.split(delim);
        if (parts.length >= 2) {
          for (let splitIdx = 1; splitIdx < parts.length; splitIdx++) {
            let part1 = parts.slice(0, splitIdx).join(' ').trim();
            let part2 = parts.slice(splitIdx).join(' ').trim();
            if (ctx.measureText(part1).width <= maxWidth && ctx.measureText(part2).width <= maxWidth) {
              return [part1, part2];
            }
          }
        }
      }

      // 2. 띄어쓰기(어절) 단위로 2줄로 나누었을 때 좌우 균형이 가장 잘 맞는 분기점 탐색
      const words = text.split(' ');
      let bestSplit = null;
      let minDiff = Infinity;

      for (let i = 1; i < words.length; i++) {
        let line1 = words.slice(0, i).join(' ');
        let line2 = words.slice(i).join(' ');
        let w1 = ctx.measureText(line1).width;
        let w2 = ctx.measureText(line2).width;

        if (w1 <= maxWidth && w2 <= maxWidth) {
          let diff = Math.abs(w1 - w2);
          if (diff < minDiff) {
            minDiff = diff;
            bestSplit = [line1, line2];
          }
        }
      }

      if (bestSplit) return bestSplit;

      // 3. 3줄 이상 필요한 긴 문장이거나 긴 단어에 대한 그리디 분할
      let lines = [];
      let cur = '';
      for (let word of words) {
        let test = cur ? (cur + ' ' + word) : word;
        if (ctx.measureText(test).width <= maxWidth) {
          cur = test;
        } else {
          if (cur) lines.push(cur);
          if (ctx.measureText(word).width > maxWidth) {
            let sub = '';
            for (let ch of word) {
              if (ctx.measureText(sub + ch).width <= maxWidth) {
                sub += ch;
              } else {
                lines.push(sub);
                sub = ch;
              }
            }
            cur = sub;
          } else {
            cur = word;
          }
        }
      }
      if (cur) lines.push(cur);
      return lines;
    }

    // 화면 너비에 맞춰 폰트 크기 및 줄간격을 자동 조절하고 선명한 외곽선과 함께 렌더링
    function renderWrappedQuestion(ctx, text, centerX, centerY, maxWidth, baseFontSize, onParchment = true) {
      let fontSize = baseFontSize;
      if (text.length > 30) fontSize = Math.floor(baseFontSize * 0.75);
      else if (text.length > 18) fontSize = Math.floor(baseFontSize * 0.85);

      ctx.font = `bold ${fontSize}px 'Cinzel', 'Gowun Batang', serif`;
      let lines = splitQuestionText(ctx, text, maxWidth);

      // 3줄 이상인 경우 폰트를 조금 줄여서 2줄 내로 보기 좋게 압축
      while (lines.length > 2 && fontSize > Math.floor(baseFontSize * 0.55)) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px 'Cinzel', 'Gowun Batang', serif`;
        lines = splitQuestionText(ctx, text, maxWidth);
      }

      const lineHeight = fontSize * 1.35;
      const totalH = (lines.length - 1) * lineHeight;
      const startY = centerY - totalH / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (onParchment) {
        ctx.strokeStyle = 'rgba(255, 235, 190, 0.5)';
        ctx.lineWidth = Math.max(2, fontSize * 0.05);
        ctx.fillStyle = '#2c1505';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 2;
      } else {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = Math.max(3, fontSize * 0.1);
        ctx.fillStyle = '#ffe082';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;
      }

      for (let i = 0; i < lines.length; i++) {
        let lineY = startY + i * lineHeight;
        if (!onParchment) ctx.strokeText(lines[i], centerX, lineY);
        ctx.fillText(lines[i], centerX, lineY);
      }

      return { lines, fontSize, totalH };
    }

    function createRawQuestion() {
      const candidates = questionDB.filter(q => q.level === currentLevel && q.subLevel === currentSubLevel);
      if (candidates.length === 0) return { q: "문제를 불러오는 중...", c: "0", w: "1", shape: null, template: "" };
      
      // 단순 연산(1-1, 1-2, 1-3, 1-4, 2-3, 2-5, 4-2) 외의 모든 세부단계에서는
      // 현재 라운드(10문제) 동안 이미 출제된 유형(qTemp)을 제외한 후보군에서 추출하여
      // 숫자만 바뀐 동일한 유형의 문제가 연속해서 나오지 않도록 100% 유형 다양성을 보장합니다.
      const isPureArithmetic = (currentLevel === 1 && [1,2,3,4].includes(currentSubLevel)) ||
                               (currentLevel === 2 && [3,5].includes(currentSubLevel)) ||
                               (currentLevel === 4 && currentSubLevel === 2);

      let availableCandidates = candidates;
      if (!isPureArithmetic) {
        let unused = candidates.filter(c => !currentRoundTemplates.includes(c.qTemp));
        if (unused.length > 0) {
          availableCandidates = unused;
        } else {
          // 해당 세부단계의 모든 유형을 한 번씩 다 풀었으면 라운드 템플릿 목록을 초기화하여 순환
          currentRoundTemplates = [];
          availableCandidates = candidates;
        }
      }
      
      let t, A, B, C, D, q, c, w;
      let evalAttempts = 0;
      do {
        t = pick(availableCandidates);
        A = 0; B = 0; C = 0; D = 0;
        try { A = eval(t.va); } catch(e){ console.error("A eval error", e); }
        try { B = eval(t.vb); } catch(e){ console.error("B eval error", e); }
        try { C = eval(t.vc); } catch(e){ console.error("C eval error", e); }
        try { D = eval(t.vd); } catch(e){ console.error("D eval error", e); }
        
        q = t.qTemp.replace(/\{A\}/g, A).replace(/\{B\}/g, B).replace(/\{C\}/g, C).replace(/\{D\}/g, D);
        q = q.replace(/\{([^}]+)\}/g, (m, expr) => {
          try { return eval(expr); } catch(e) { return m; }
        });
        
        c = ""; w = "";
        try { c = eval(t.cTemp); } catch(e){ c = "err"; console.error("C eval error", e); }
        try { w = eval(t.wTemp); } catch(e){ w = "err"; console.error("W eval error", e); }
        evalAttempts++;
      } while (c.toString() === w.toString() && evalAttempts < 10);

      // 좌우 동일한 답 방지 보장 (Fallback Guarantee)
      if (c.toString() === w.toString()) {
        if (!isNaN(Number(c))) {
          let numC = Number(c);
          w = (numC === 0 ? 1 : numC + 1).toString();
        } else if (c === '직사각형') {
          w = '정사각형';
        } else if (c === '정사각형') {
          w = '직사각형';
        } else if (c === '=') {
          w = '≠';
        } else if (c === '≠') {
          w = '=';
        } else if (c.endsWith('층')) {
          w = (c === '2층' ? '3층' : '2층');
        } else if (c.endsWith('°')) {
          w = (c === '360°' ? '180°' : '360°');
        } else if (c.endsWith('%')) {
          let pVal = parseInt(c);
          w = (!isNaN(pVal) ? (pVal + 10) + '%' : '50%');
        } else {
          w = c.toString() + "'";
        }
      }
      
      let shapeObj = null;
      if (t.shape && t.shape.trim() !== "" && t.shape.trim() !== "0") {
          try { eval("shapeObj = (" + t.shape + ")"); } catch(e){ console.error("Shape eval error", e, t.shape); }
      }
      
      return { q: q.toString(), c: c.toString(), w: w.toString(), shape: shapeObj, template: t.qTemp };
    }

    function generateQuestion() {
      if (Math.random() > 0.5) { 
        leftBoxRequiredHand = "left"; rightBoxRequiredHand = "right"; 
        isCrossMode = false;
      } else { 
        leftBoxRequiredHand = "right"; rightBoxRequiredHand = "left"; 
        isCrossMode = true;
      }

      let data;
      let attempts = 0;
      let identity = "";
      do {
        data = createRawQuestion();
        let shapeKey = data.shape ? JSON.stringify(data.shape) : "";
        identity = data.q + (shapeKey ? "::" + shapeKey : "");
        attempts++;
      } while (previousQuestions.includes(identity) && attempts < 60);
      
      if (data.template) {
        currentRoundTemplates.push(data.template);
      }
      previousQuestions.push(identity);
      if (previousQuestions.length > 35) previousQuestions.shift(); 

      questionText = data.q;
      questionShape = data.shape;
      
      if (Math.random() > 0.5) { 
         correctSide = "left"; leftAnswerText = data.c; rightAnswerText = data.w; 
      } else { 
         correctSide = "right"; leftAnswerText = data.w; rightAnswerText = data.c; 
      }

      // 좌우 동일 답 최종 방지
      if (leftAnswerText === rightAnswerText) {
        rightAnswerText = leftAnswerText + "'";
      }
    }

    function saveRecord(level, sub, timeStr) {
      let key = `leaderboard_${level}_${sub}`;
      let records = JSON.parse(localStorage.getItem(key) || "[]");
      records.push(timeStr);
      records.sort((a,b) => parseFloat(a) - parseFloat(b));
      records = records.slice(0, 3);
      localStorage.setItem(key, JSON.stringify(records));
      return records;
    }

    function onResults(results) {
      if (loadingText.style.display !== 'none') loadingText.style.display = 'none';

      const width = canvasElement.width;
      const height = canvasElement.height;

      canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
      canvasCtx.clearRect(0, 0, width, height);



      canvasCtx.save();
      canvasCtx.translate(width, 0);
      canvasCtx.scale(-1, 1);
      canvasCtx.globalAlpha = (gameState.startsWith("menu") || gameState==="result" || gameState==="paused") ? 0.5 : 0.8;
      canvasCtx.drawImage(results.image, 0, 0, width, height);
      
      // 타격 프레임 시 화이트 플래시 (Hit Stop Flash)
      if (gameState === 'correct') {
          let elapsed = Date.now() - stateTimer;
          if (elapsed < 50) {
              canvasCtx.fillStyle = combo >= 3 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
              canvasCtx.fillRect(0, 0, width, height);
          }
      }
      
      canvasCtx.globalAlpha = 1.0;
      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: 'rgba(0,255,0,0.5)', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: 'rgba(255,0,0,0.5)', lineWidth: 2, radius: 3});
      }
      canvasCtx.restore();

      if (gameState === "paused") {
          canvasCtx.fillStyle = 'rgba(10, 5, 2, 0.75)';
          canvasCtx.fillRect(0, 0, width, height);
          
          drawParchmentScroll(canvasCtx, width/2 - 270, height * 0.20, 540, height * 0.62, "일시 정지 (PAUSED)");

          const resumeBtn = { x: width/2 - 220, y: height * 0.42, w: 440, h: height * 0.11, text: "결계 재개 (계속하기)" };
          const quitBtn = { x: width/2 - 220, y: height * 0.60, w: 440, h: height * 0.11, text: "아카데미로 (메뉴로)" };
          
          if (!window.pauseProgressMap) window.pauseProgressMap = { resume: 0, quit: 0 };

          const leftPalm = getPalm(results.poseLandmarks, true, width, height);
          const rightPalm = getPalm(results.poseLandmarks, false, width, height);

          const checkBtn = (btn, lp, rp) => {
              const check = (p) => {
                 if(!p) return false;
                 return (p.x > btn.x && p.x < btn.x+btn.w && p.y > btn.y && p.y < btn.y+btn.h);
              };
              return check(lp) || check(rp);
          };

          if (checkBtn(resumeBtn, leftPalm, rightPalm)) {
              if(window.pauseProgressMap.resume === 0) playSound('hover');
              window.pauseProgressMap.resume += 2;
              if (window.pauseProgressMap.resume >= 100) {
                  window.pauseProgressMap.resume = 0;
                  playSound('start');
                  gameState = previousGameState;
                  if (bgmEnabled) startBGM();
                  if (gameState === "playing" && isCrossMode) startCrossSound();
                  renderCursors(results, canvasCtx, width, height);
                  return;
              }
          } else { window.pauseProgressMap.resume = Math.max(0, window.pauseProgressMap.resume - 3); }

          if (checkBtn(quitBtn, leftPalm, rightPalm)) {
              if(window.pauseProgressMap.quit === 0) playSound('hover');
              window.pauseProgressMap.quit += 2;
              if (window.pauseProgressMap.quit >= 100) {
                  window.pauseProgressMap.quit = 0;
                  playSound('start');
                  initMenuMain();
                  renderCursors(results, canvasCtx, width, height);
                  return;
              }
          } else { window.pauseProgressMap.quit = Math.max(0, window.pauseProgressMap.quit - 3); }

          [resumeBtn, quitBtn].forEach(b => {
              canvasCtx.save();
              canvasCtx.fillStyle = '#2b170c';
              canvasCtx.fillRect(b.x, b.y, b.w, b.h);
              let prog = b === resumeBtn ? window.pauseProgressMap.resume : window.pauseProgressMap.quit;
              if (prog > 0) {
                canvasCtx.fillStyle = 'rgba(0, 230, 255, 0.45)';
                canvasCtx.fillRect(b.x, b.y, b.w * (prog/100), b.h);
              }
              canvasCtx.strokeStyle = '#ffd700';
              canvasCtx.lineWidth = 3;
              canvasCtx.strokeRect(b.x, b.y, b.w, b.h);
              canvasCtx.fillStyle = '#ffe082';
              canvasCtx.font = `bold ${Math.floor(b.h*0.42)}px 'Cinzel', 'Gowun Batang', serif`;
              canvasCtx.textAlign = 'center';
              canvasCtx.textBaseline = 'middle';
              canvasCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
              canvasCtx.shadowBlur = 6;
              canvasCtx.fillText(b.text, b.x + b.w/2, b.y + b.h/2);
              canvasCtx.restore();
          });
          renderCursors(results, canvasCtx, width, height);
          return;
      }

      if (gameState === "menu_main" || gameState === "menu_sub" || gameState === "result") {
        if (gameState !== "result") {
            // 상단 양피지 퀘스트 배너
            const bannerText = gameState === "menu_main" 
              ? "마법 연금술 아카데미 : 연산 퀘스트" 
              : `[ ${getLevelTitle(currentLevel)} ] 난이도 선택`;
            drawParchmentScroll(canvasCtx, width * 0.18, height * 0.02, width * 0.64, height * 0.08, bannerText);

            // 화면 모서리 황금 코너 브래킷
            canvasCtx.save();
            canvasCtx.strokeStyle = '#ffd700';
            canvasCtx.lineWidth = 4;
            const cSize = Math.min(width, height) * 0.06;
            // Top-Left
            canvasCtx.beginPath(); canvasCtx.moveTo(20, 20 + cSize); canvasCtx.lineTo(20, 20); canvasCtx.lineTo(20 + cSize, 20); canvasCtx.stroke();
            // Top-Right
            canvasCtx.beginPath(); canvasCtx.moveTo(width - 20 - cSize, 20); canvasCtx.lineTo(width - 20, 20); canvasCtx.lineTo(width - 20, 20 + cSize); canvasCtx.stroke();
            // Bottom-Left
            canvasCtx.beginPath(); canvasCtx.moveTo(20, height - 20 - cSize); canvasCtx.lineTo(20, height - 20); canvasCtx.lineTo(20 + cSize, height - 20); canvasCtx.stroke();
            // Bottom-Right
            canvasCtx.beginPath(); canvasCtx.moveTo(width - 20 - cSize, height - 20); canvasCtx.lineTo(width - 20, height - 20); canvasCtx.lineTo(width - 20, height - 20 - cSize); canvasCtx.stroke();
            canvasCtx.restore();
            
            if (results.poseLandmarks) {
              const leftPalm = getPalm(results.poseLandmarks, true, width, height); 
              const rightPalm = getPalm(results.poseLandmarks, false, width, height); 
              for(let box of menuBoxes) {
                let isHover = false;
                const check = (p) => {
                  if(!p) return;
                  let dist = Math.hypot(p.x - box.cx, p.y - box.cy);
                  if (dist < box.r) isHover = true;
                };
                check(leftPalm); check(rightPalm);
                
                if(isHover) {
                  if(!box.hovered) { box.hovered = true; playSound('hover'); }
                  box.progress += 2.2; 
                } else { 
                  box.hovered = false;
                  box.progress = Math.max(0, box.progress - 3); 
                }
                
                if(box.progress >= 100) {
                  if(box.flash < 15) {
                     box.flash++;
                  } else {
                     playSound('start');
                     if(gameState === "menu_main") {
                        initMenuSub(box.id);
                     } else {
                        if (box.id === "back") initMenuMain();
                        else startGame(box.id);
                     }
                     renderCursors(results, canvasCtx, width, height);
                     return;
                  }
                } else {
                   box.flash = 0;
                }
              }
            }

            // 황금 룬 메달리온으로 버튼 렌더링
            for(let box of menuBoxes) {
              drawOrnateMedallion(canvasCtx, box);
            }
         } else {
            // ================= 결과 화면 (왕립 마법 아카데미 졸업 칙령) =================
            canvasCtx.fillStyle = 'rgba(8, 4, 2, 0.85)';
            canvasCtx.fillRect(0, 0, width, height);

            const docW = Math.min(width * 0.72, 850);
            const docH = height * 0.86;
            const docX = width / 2 - docW / 2;
            const docY = height * 0.07;
            drawParchmentScroll(canvasCtx, docX, docY, docW, docH, "왕립 마법 연금술 아카데미 토벌 보고서");

            canvasCtx.save();
            canvasCtx.textAlign = 'center';

            // 클리어 타이틀
            canvasCtx.font = `bold ${Math.floor(docH * 0.08)}px 'Cinzel', 'Gowun Batang', serif`;
            canvasCtx.fillStyle = '#b8860b';
            canvasCtx.shadowColor = '#ffe082';
            canvasCtx.shadowBlur = 10;
            canvasCtx.fillText(`[ ${getSubTitle(currentLevel, currentSubLevel)} ] 토벌 완료!`, width/2, docY + docH * 0.16);

            // 보스 격퇴 자막
            canvasCtx.font = `bold ${Math.floor(docH * 0.05)}px 'Cinzel', 'Gowun Batang', serif`;
            canvasCtx.fillStyle = '#a82400';
            canvasCtx.shadowBlur = 0;
            canvasCtx.fillText(`[BOSS] 고대 화염룡 알렉스트라자를 격퇴하였습니다!`, width/2, docY + docH * 0.24);

            // 세부 성적
            canvasCtx.font = `bold ${Math.floor(docH * 0.052)}px 'Gowun Batang', serif`;
            canvasCtx.fillStyle = '#2c1808';
            canvasCtx.fillText(`정답: ${MAX_QUESTIONS_PER_LEVEL}회  |  오답: ${totalWrongCount}회`, width/2, docY + docH * 0.33);

            let timeStr = ((endTime - startTime)/1000).toFixed(2);
            canvasCtx.font = `bold ${Math.floor(docH * 0.055)}px 'Cinzel', serif`;
            canvasCtx.fillStyle = '#0f4c81';
            canvasCtx.fillText(`토벌 시간: ${timeStr} 초`, width/2, docY + docH * 0.42);

            // 명예의 전당 Top 3
            let records = JSON.parse(localStorage.getItem(`leaderboard_${currentLevel}_${currentSubLevel}`) || "[]");
            canvasCtx.font = `bold ${Math.floor(docH * 0.052)}px 'Cinzel', 'Gowun Batang', serif`;
            canvasCtx.fillStyle = '#7a4805';
            canvasCtx.fillText(`명예의 전당 (Top 3)`, width/2, docY + docH * 0.52);

            canvasCtx.font = `bold ${Math.floor(docH * 0.045)}px 'Cinzel', serif`;
            canvasCtx.fillStyle = '#3a210d';
            const medals = ['1위', '2위', '3위'];
            for(let i=0; i<records.length; i++) {
              canvasCtx.fillText(`${medals[i] || `${i+1}위`}: ${records[i]} 초`, width/2, docY + docH * 0.60 + i * docH * 0.07);
            }

            // 메뉴로 복귀 버튼 (밀랍 인장 스타일)
            const returnBtnW = Math.min(docW * 0.55, 360);
            const returnBtnH = docH * 0.10;
            const returnBtnX = width / 2 - returnBtnW / 2;
            const returnBtnY = docY + docH * 0.83;

            canvasCtx.fillStyle = '#3e1d10';
            canvasCtx.fillRect(returnBtnX, returnBtnY, returnBtnW, returnBtnH);
            if (!this.backProg) this.backProg = 0;
            if (this.backProg > 0) {
              canvasCtx.fillStyle = 'rgba(0, 230, 255, 0.5)';
              canvasCtx.fillRect(returnBtnX, returnBtnY, returnBtnW * (this.backProg/100), returnBtnH);
            }
            canvasCtx.strokeStyle = '#ffd700';
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeRect(returnBtnX, returnBtnY, returnBtnW, returnBtnH);

            canvasCtx.fillStyle = '#ffe082';
            canvasCtx.font = `bold ${Math.floor(returnBtnH * 0.45)}px 'Cinzel', 'Gowun Batang', serif`;
            canvasCtx.textBaseline = 'middle';
            canvasCtx.fillText("아카데미로 복귀", width/2, returnBtnY + returnBtnH/2);
            canvasCtx.restore();

           if (results.poseLandmarks) {
             const leftPalm = getPalm(results.poseLandmarks, true, width, height);
             const rightPalm = getPalm(results.poseLandmarks, false, width, height);
             const check = (p) => {
                 if(!p) return false;
                 return (p.x > returnBtnX && p.x < returnBtnX + returnBtnW && p.y > returnBtnY && p.y < returnBtnY + returnBtnH);
             };
             if (check(leftPalm) || check(rightPalm)) {
                if(this.backProg === 0) playSound('hover');
                this.backProg += 2.2;
                if(this.backProg >= 100) { playSound('start'); this.backProg = 0; initMenuMain(); }
             } else {
                if(this.backProg) this.backProg = Math.max(0, this.backProg - 3);
             }
           }
        }
        renderCursors(results, canvasCtx, width, height);
        return;
      }

      // ================= 3D 투시 원근 그리드 바닥 =================
      const gridSpeed = (gameState === "running") ? (4.2 * runMultiplier) : 0.8;
      draw3DPerspectiveGrid(canvasCtx, width, height, gridSpeed);

      // ================= 거대 보스 발밑 소환 마법진 =================
      drawBossSummoningCircle(canvasCtx, boss.x, boss.y + boss.size * 0.36, boss.size * 0.82, boss.size * 0.28);

      // ================= 거대 보스 몬스터 등장 =================
      boss.draw(canvasCtx, width, height);
      boss.drawHpBar(canvasCtx, width, height);

      // ================= 플레이어 체력(HP) 게이지 =================
      drawPlayerHpBar(canvasCtx, width, height);

      // ================= 미니언 러시 3D 디펜스 =================
      updateAndDrawMinions(canvasCtx, width, height);

      // ================= 오답 시 보스 대형 화염탄 화면 직격 =================
      updateAndDrawBossAttackFireball(canvasCtx, width, height);

      // ================= 잔여 마나 흡수 파티클 마무리 =================
      if (gameState !== "running" && manaGatherParticles.length > 0) {
        updateAndDrawManaGather(canvasCtx, width / 2, height * 0.80, false);
      }

      // ================= 플레이어 피격 비넷 =================
      drawPlayerHurtVignette(canvasCtx, width, height);

      let currentLeftOccupied = false;
      let currentRightOccupied = false;

      if (results.poseLandmarks && results.poseLandmarks[11] && results.poseLandmarks[12]) {
        let lsX = (1.0 - results.poseLandmarks[11].x) * width; 
        let rsX = (1.0 - results.poseLandmarks[12].x) * width; 
        
        let minX = Math.min(lsX, rsX);
        let maxX = Math.max(lsX, rsX);

        smoothedLeftShoulderX = smoothedLeftShoulderX * 0.9 + minX * 0.1;
        smoothedRightShoulderX = smoothedRightShoulderX * 0.9 + maxX * 0.1;
        
        let sY = (results.poseLandmarks[11].y + results.poseLandmarks[12].y)/2 * height;
        sY = Math.max(height * 0.2, Math.min(sY, height * 0.7)); 
        smoothedShoulderY = smoothedShoulderY * 0.9 + sY * 0.1;
      }

      const circleRadius = Math.min(width * 0.11, height * 0.11, 95); 
      
      let shoulderWidth = Math.max(120, Math.abs(smoothedRightShoulderX - smoothedLeftShoulderX));
      let outOffset = shoulderWidth * 0.45; 
      
      const leftCenterX = Math.max(circleRadius + 30, Math.min(smoothedLeftShoulderX - outOffset, width * 0.40));
      const rightCenterX = Math.min(width - circleRadius - 30, Math.max(smoothedRightShoulderX + outOffset, width * 0.60));
      const orbCenterY = Math.max(height * 0.66, Math.min(smoothedShoulderY, height * 0.78));
      const leftCenterY = orbCenterY; 
      const rightCenterY = orbCenterY;

      if (results.poseLandmarks) {
        const shoulderY = (results.poseLandmarks[11].y + results.poseLandmarks[12].y) / 2;
        if (baseShoulderY === 0) baseShoulderY = shoulderY;
        baseShoulderY = baseShoulderY * 0.9 + shoulderY * 0.1; 

        if (shoulderY < baseShoulderY - 0.02) isStepUp = true;
        if (isStepUp && shoulderY > baseShoulderY) {
          isStepUp = false;
          if (gameState === "running") runGauge += 15;
        }

        const leftPalm = getPalm(results.poseLandmarks, true, width, height);
        const rightPalm = getPalm(results.poseLandmarks, false, width, height);
        
        const checkHit = (palm, targetX, targetY) => {
          if (!palm) return false;
          return Math.hypot(palm.x - targetX, palm.y - targetY) < circleRadius;
        };

        const hitLeftByLeft = checkHit(leftPalm, leftCenterX, leftCenterY);
        const hitLeftByRight = checkHit(rightPalm, leftCenterX, leftCenterY);
        const hitRightByLeft = checkHit(leftPalm, rightCenterX, rightCenterY);
        const hitRightByRight = checkHit(rightPalm, rightCenterX, rightCenterY);

        const leftHit = hitLeftByLeft || hitLeftByRight;
        const rightHit = hitRightByLeft || hitRightByRight;

        if ((hitLeftByLeft && hitLeftByRight) || (hitRightByLeft && hitRightByRight) || (leftHit && rightHit)) {
            currentLeftOccupied = false;
            currentRightOccupied = false;
        } else {
            if (leftBoxRequiredHand === 'left' && hitLeftByLeft) currentLeftOccupied = true;
            if (leftBoxRequiredHand === 'right' && hitLeftByRight) currentLeftOccupied = true;
            if (rightBoxRequiredHand === 'right' && hitRightByRight) currentRightOccupied = true;
            if (rightBoxRequiredHand === 'left' && hitRightByLeft) currentRightOccupied = true;
        }
      }

      if (gameState === "running") {
        runGauge -= 0.3;
        if (runGauge < 0) runGauge = 0;
        
        if (runGauge >= targetRunGauge) {
          runGauge = 0; 
          gameState = "playing";
          playingCooldownUntil = Date.now() + 450; // 달리기 모션으로 인한 찰나의 오답 방지 쿨다운
          prevLeftOccupied = true; // 전환 순간 즉시 트리거되는 현상 방지
          prevRightOccupied = true;
          if (isCrossMode) startCrossSound();
        }
      }

      if (gameState === 'playing') {
        const triggerLeft = currentLeftOccupied && !prevLeftOccupied;
        const triggerRight = currentRightOccupied && !prevRightOccupied;

        if ((triggerLeft || triggerRight) && Date.now() >= playingCooldownUntil) {
          const selectedSide = triggerLeft ? "left" : "right";
          lastHitSide = selectedSide;
          stopCrossSound(); 
          
          if (selectedSide === correctSide) {
            gameState = "correct";
            stateTimer = Date.now();
            score += 10;
            questionCount++;
            combo++;
            runMultiplier = Math.max(1.0, runMultiplier - 0.5);
            targetRunGauge = 100 * runMultiplier;
            
            updateBGM(combo >= 3);

            // 사용한 손에 따라 발사 마법 결정 (오른손: 파이어볼, 왼손: 냉기폭발)
            const usedHand = (selectedSide === 'left') ? leftBoxRequiredHand : rightBoxRequiredHand;
            const spellType = (usedHand === 'right') ? 'fireball' : 'frostblast';
            
            // [정답 특수 연출] 문제가 바스라져 룬 구체로 수렴 후 보스에게 마법 발사!
            const targetOrbX = (selectedSide === 'left') ? leftCenterX : rightCenterX;
            const targetOrbY = (selectedSide === 'left') ? leftCenterY : rightCenterY;
            const qBoxW = Math.min(width * 0.74, 800);
            const qBoxH = Math.max(85, height * 0.16);
            startQuestionShatter(questionText, width / 2, height * 0.435, qBoxW, qBoxH, targetOrbX, targetOrbY, selectedSide === 'left', spellType, combo);
            sweepAndDestroyMinions(spellType);

            if (combo >= 3) {
              playSound('combo');
              createParticles(selectedSide === 'left' ? leftCenterX : rightCenterX, selectedSide === 'left' ? leftCenterY : rightCenterY, true);
              canvasElement.classList.remove('shake-normal', 'shake-heavy');
              void canvasElement.offsetWidth;
              canvasElement.classList.add('shake-heavy');
            } else {
              playSound('correct');
              createParticles(selectedSide === 'left' ? leftCenterX : rightCenterX, selectedSide === 'left' ? leftCenterY : rightCenterY, false);
              canvasElement.classList.remove('shake-normal', 'shake-heavy');
              void canvasElement.offsetWidth;
              canvasElement.classList.add('shake-normal');
            }
            
            if (questionCount >= MAX_QUESTIONS_PER_LEVEL) {
               endTime = Date.now();
               saveRecord(currentLevel, currentSubLevel, ((endTime - startTime)/1000).toFixed(2));
               setTimeout(() => { stopBGM(); gameState = "result"; }, 1500);
               return;
            }
          } else {
            // [오답 특수 연출] 문제가 푸스스 재와 연기로 사라짐
            gameState = "wrong";
            stateTimer = Date.now();
            score = Math.max(0, score - 5);
            combo = 0; 
            totalWrongCount++;
            updateBGM(false); 
            runMultiplier = Math.min(3.0, runMultiplier + 0.5);
            targetRunGauge = 100 * runMultiplier;
            playSound('wrong');

            const qBoxW = Math.min(width * 0.74, 800);
            const qBoxH = Math.max(85, height * 0.16);
            startQuestionFizzle(questionText, width / 2, height * 0.435, qBoxW, qBoxH);

            // [오답 시 보스 대형 화염탄 반격 & 미니언 2배 증원 러시]
            bossAttackFireball = { x: boss.x, y: boss.y, progress: 0, speed: 0.055 };
            spawnMinionWave(4);
          }
          setTimeout(() => { 
            if(gameState !== "result") { 
               generateQuestion(); 
               gameState = "running"; 
            } 
          }, 1500);
        }
      }

      prevLeftOccupied = currentLeftOccupied;
      prevRightOccupied = currentRightOccupied;

      // ================= 상단 HUD (고풍스러운 왕립 양피지 리본) =================
      const hudW = Math.min(width * 0.65, 700);
      const hudH = Math.max(42, height * 0.060);
      const hudX = width / 2 - hudW / 2;
      const hudY = height * 0.014;
      drawParchmentScroll(canvasCtx, hudX, hudY, hudW, hudH);

      canvasCtx.save();
      canvasCtx.textAlign = 'center';
      canvasCtx.textBaseline = 'top';

      let titleStr = `${getLevelTitle(currentLevel)} - ${getSubTitle(currentLevel, currentSubLevel)}`;
      canvasCtx.font = `bold ${Math.floor(hudH * 0.40)}px 'Cinzel', 'Gowun Batang', serif`;
      canvasCtx.fillStyle = '#3a1f0a';
      canvasCtx.shadowColor = 'rgba(255, 230, 180, 0.8)';
      canvasCtx.shadowBlur = 3;
      canvasCtx.fillText(`[ ${titleStr} ]`, width / 2, hudY + hudH * 0.10);

      canvasCtx.font = `bold ${Math.floor(hudH * 0.32)}px 'Cinzel', 'Gowun Batang', serif`;
      canvasCtx.fillStyle = '#5c3311';
      canvasCtx.fillText(`마나: ${score}  |  연속 콤보: ${combo}  |  시간: ${((Date.now() - startTime)/1000).toFixed(1)}s`, width / 2, hudY + hudH * 0.54);
      canvasCtx.restore();

      // ================= 일시 정지 버튼 (우측 하단) =================
      if (gameState === "running" || gameState === "playing") {
          const pauseBtnW = Math.min(width * 0.11, 120);
          const pauseBtnH = Math.max(32, height * 0.048);
          const pauseBtnX = width - pauseBtnW - 20;
          const pauseBtnY = height - pauseBtnH - 20;

          const checkPauseHover = (palm) => {
              if (!palm) return false;
              return (palm.x > pauseBtnX && palm.x < pauseBtnX + pauseBtnW && palm.y > pauseBtnY && palm.y < pauseBtnY + pauseBtnH);
          };

          if (checkPauseHover(leftPalm) || checkPauseHover(rightPalm)) {
              if(!window.pauseHoverProgress) window.pauseHoverProgress = 0;
              if(window.pauseHoverProgress === 0) playSound('hover');
              window.pauseHoverProgress += 3;
              if (window.pauseHoverProgress >= 100) {
                  window.pauseHoverProgress = 0;
                  playSound('start');
                  previousGameState = gameState;
                  gameState = "paused";
                  stopBGM();
                  stopCrossSound();
                  return; 
              }
          } else {
              if(window.pauseHoverProgress) window.pauseHoverProgress = Math.max(0, window.pauseHoverProgress - 3);
          }

          canvasCtx.save();
          canvasCtx.fillStyle = 'rgba(40, 20, 10, 0.85)';
          canvasCtx.fillRect(pauseBtnX, pauseBtnY, pauseBtnW, pauseBtnH);
          if(window.pauseHoverProgress) {
              canvasCtx.fillStyle = 'rgba(255, 60, 0, 0.5)';
              canvasCtx.fillRect(pauseBtnX, pauseBtnY, pauseBtnW * (window.pauseHoverProgress/100), pauseBtnH);
          }
          canvasCtx.strokeStyle = '#ffd700';
          canvasCtx.lineWidth = 2.5;
          canvasCtx.strokeRect(pauseBtnX, pauseBtnY, pauseBtnW, pauseBtnH);
          canvasCtx.fillStyle = '#ffe082';
          canvasCtx.font = `bold ${Math.floor(pauseBtnH*0.42)}px 'Cinzel', 'Gowun Batang', serif`;
          canvasCtx.textAlign = 'center';
          canvasCtx.textBaseline = 'middle';
          canvasCtx.fillText("결계 정지", pauseBtnX + pauseBtnW/2, pauseBtnY + pauseBtnH/2);
          canvasCtx.restore();
      }

      // ================= 달리기 (질주 & 마나 충전) 페이즈 =================
      if (gameState === "running") {
        let p = runGauge / targetRunGauge;
        let scale = Math.max(0.02, Math.pow(p, 3)); 
        let qY = (height * 0.48) + (height * 0.38 - height * 0.48) * p;
        
        canvasCtx.save();
        canvasCtx.translate(width/2, qY);
        canvasCtx.scale(scale, scale);
        
        let qInfoRun = renderWrappedQuestion(canvasCtx, questionText, 0, 0, width * 0.84, Math.floor(height * 0.10), false);

        if (questionShape) {
            let shapeCenterY = 0;
            if (qInfoRun.lines.length > 1) {
                shapeCenterY -= (qInfoRun.totalH / 2 + 15);
            }
            canvasCtx.save();
            canvasCtx.translate(0, shapeCenterY);
            drawShapeData(canvasCtx, questionShape);
            canvasCtx.restore();
        }
        
        canvasCtx.font = `bold ${Math.floor(height*0.06)}px 'Cinzel', 'Gowun Batang', serif`;
        canvasCtx.fillStyle = '#ffe89e';
        canvasCtx.shadowColor = '#ffd700';
        canvasCtx.shadowBlur = 8;
        let ansY = Math.max(height * 0.1, qInfoRun.totalH / 2 + qInfoRun.fontSize * 0.9);
        canvasCtx.fillText(`[ ${leftAnswerText} ]      [ ${rightAnswerText} ]`, 0, ansY);
        canvasCtx.restore();

        // 연금술 마나 플라스크 게이지 바
        const barWidth = Math.min(width * 0.50, 560);
        const barHeight = Math.max(28, height * 0.052);
        const barX = width / 2 - barWidth / 2;
        const barY = height * 0.80;
        let fillRatio = Math.min(1.0, runGauge / targetRunGauge);
        updateAndDrawManaGather(canvasCtx, barX + barWidth * fillRatio, barY + barHeight / 2, true);
        drawManaFlaskGauge(canvasCtx, barX, barY, barWidth, barHeight, fillRatio, runMultiplier);

        canvasCtx.save();
        canvasCtx.fillStyle = '#ffe082';
        canvasCtx.font = `bold ${Math.floor(height*0.045)}px 'Cinzel', 'Gowun Batang', serif`;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'alphabetic';
        canvasCtx.shadowColor = '#ff8800';
        canvasCtx.shadowBlur = 12;
        canvasCtx.fillText("제자리에서 달려 마나를 충전하세요!", width / 2, barY - height * 0.025);
        if (runMultiplier > 1.0) {
          canvasCtx.fillStyle = '#ff4444';
          canvasCtx.font = `bold ${Math.floor(height*0.035)}px 'Gowun Batang', serif`;
          canvasCtx.fillText(`오답 패널티! ${runMultiplier}배 더 뛰어야 합니다!`, width / 2, barY + barHeight + height * 0.035);
        }
        canvasCtx.restore();

      } else if (gameState === "playing") {
        // ================= 문제 플레이 페이즈 =================
        // 정답/오답으로 파편이 날아가거나 재로 변하는 중이 아니면 양피지 문제 카드 렌더링
        if (questionShatterParticles.length === 0 && questionFizzleParticles.length === 0) {
          const qBoxW = Math.min(width * 0.74, 800);
          const qBoxH = Math.max(85, height * 0.16);
          const qBoxX = width / 2 - qBoxW / 2;
          const qBoxY = height * 0.355;
          drawParchmentScroll(canvasCtx, qBoxX, qBoxY, qBoxW, qBoxH);

          let qInfoPlay = renderWrappedQuestion(canvasCtx, questionText, width / 2, qBoxY + qBoxH * 0.52, qBoxW * 0.9, Math.floor(height * 0.075));

          if (questionShape) {
              canvasCtx.save();
              let shapeCenterY = qBoxY + qBoxH * 0.5;
              if (qInfoPlay.lines.length > 1) {
                  shapeCenterY -= (qInfoPlay.totalH / 2 + 15);
              }
              canvasCtx.translate(width / 2, shapeCenterY); 
              drawShapeData(canvasCtx, questionShape);
              canvasCtx.restore();
          }
        }

        // 타격 방향 안내 (정방향 / 크로스 펀치)
        canvasCtx.save();
        canvasCtx.textAlign = 'center';
        if (leftBoxRequiredHand === 'left') {
          canvasCtx.fillStyle = '#ffe082'; 
          canvasCtx.font = `bold ${Math.floor(height*0.040)}px 'Cinzel', 'Gowun Batang', serif`;
          canvasCtx.shadowColor = '#00ffcc';
          canvasCtx.shadowBlur = 10;
          canvasCtx.fillText("정방향 타격! 룬 구체를 타격하세요!", width / 2, height * 0.540);
          canvasCtx.fillStyle = '#ffffff';
          canvasCtx.font = `bold ${Math.floor(height*0.024)}px 'Gowun Batang', serif`;
          canvasCtx.fillText("(왼쪽 = 왼손  /  오른쪽 = 오른손)", width / 2, height * 0.575);
        } else {
          canvasCtx.fillStyle = '#ff4444'; 
          canvasCtx.font = `bold ${Math.floor(height*0.042)}px 'Cinzel', 'Gowun Batang', serif`;
          canvasCtx.shadowColor = '#ff0000';
          canvasCtx.shadowBlur = 15;
          canvasCtx.fillText("크로스 펀치! (교차 타격!)", width / 2, height * 0.540);
        }
        canvasCtx.restore();

        // 마법 룬 구체 렌더링 (좌: 사파이어, 우: 루비)
        drawRuneOrb(canvasCtx, leftCenterX, leftCenterY, circleRadius, leftAnswerText, true, currentLeftOccupied, isCrossMode);
        drawRuneOrb(canvasCtx, rightCenterX, rightCenterY, circleRadius, rightAnswerText, false, currentRightOccupied, isCrossMode);

      } else if (gameState === 'correct') {
        canvasCtx.save();
        let elapsed = Date.now() - stateTimer;
        let iconScale = Math.min(1.0, elapsed / 180.0);

        // 주문 성공 기본 텍스트
        canvasCtx.fillStyle = '#ffe082';
        canvasCtx.font = `bold ${Math.floor(height*0.065)}px 'Cinzel', 'Gowun Batang', serif`;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.shadowColor = '#00ffcc';
        canvasCtx.shadowBlur = 18;
        canvasCtx.fillText("주문 영창 성공!", width / 2, height * 0.49);

        // 2콤보 이상일 때 화면 중앙에 화려한 연속 콤보 배너 표시
        if (combo >= 2) {
          canvasCtx.save();
          const comboPulse = 1.0 + Math.sin(elapsed * 0.015) * 0.08;
          canvasCtx.translate(width / 2, height * 0.56);
          canvasCtx.scale(comboPulse, comboPulse);
          canvasCtx.font = `bold ${Math.floor(height * (combo >= 3 ? 0.080 : 0.062))}px 'Cinzel', 'Gowun Batang', serif`;
          const comboGrad = canvasCtx.createLinearGradient(-160, 0, 160, 0);
          comboGrad.addColorStop(0, '#ff4500');
          comboGrad.addColorStop(0.5, '#ffd700');
          comboGrad.addColorStop(1, '#ff2200');
          canvasCtx.fillStyle = comboGrad;
          canvasCtx.shadowColor = '#ff2200';
          canvasCtx.shadowBlur = 25;
          canvasCtx.fillText(`${combo} COMBO! 연속 영창!`, 0, 0);
          canvasCtx.restore();
        }

        let targetX = lastHitSide === 'left' ? leftCenterX : rightCenterX;
        let targetY = lastHitSide === 'left' ? leftCenterY : rightCenterY;

        canvasCtx.translate(targetX, targetY);
        canvasCtx.scale(iconScale, iconScale);
        let usedHand = (lastHitSide === 'left') ? leftBoxRequiredHand : rightBoxRequiredHand;
        let suffix = (usedHand === 'left') ? '_L' : '';
        let baseId = combo >= 3 ? 'img_combo' : 'img_correct';
        let img = document.getElementById(baseId + suffix);
        if (img) canvasCtx.drawImage(img, -circleRadius*1.4, -circleRadius*1.4, circleRadius*2.8, circleRadius*2.8);
        canvasCtx.restore();

      } else if (gameState === 'wrong') {
        canvasCtx.save();
        canvasCtx.fillStyle = '#ff3333';
        canvasCtx.font = `bold ${Math.floor(height*0.08)}px 'Cinzel', 'Gowun Batang', serif`;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.shadowColor = '#ff0000';
        canvasCtx.shadowBlur = 20;
        canvasCtx.fillText("주문 불발! (푸스스...)", width / 2, height * 0.53);

        let elapsed = Date.now() - stateTimer;
        let targetX = lastHitSide === 'left' ? leftCenterX : rightCenterX;
        let targetY = lastHitSide === 'left' ? leftCenterY : rightCenterY;
        let shake = Math.sin(elapsed / 20) * 15;

        canvasCtx.translate(targetX + shake, targetY);
        let usedHand = (lastHitSide === 'left') ? leftBoxRequiredHand : rightBoxRequiredHand;
        let suffix = (usedHand === 'left') ? '_L' : '';
        let img = document.getElementById('img_wrong' + suffix);
        if (img) canvasCtx.drawImage(img, -circleRadius*1.4, -circleRadius*1.4, circleRadius*2.8, circleRadius*2.8);
        canvasCtx.restore();
      }

      // 판타지 스펠 & 파편 효과 렌더링
      updateAndDrawFantasyEffects(canvasCtx);
      updateAndDrawParticles(canvasCtx);
      renderCursors(results, canvasCtx, width, height);
      return;
    }

    let hitParticles = [];
    function createParticles(x, y, isCombo) {
        hitParticles = [];
        hitParticles.push({ type: 'shockwave', x, y, radius: 10, maxRadius: isCombo ? 600 : 300, alpha: 1.0, speed: isCombo ? 40 : 20 });
        const numSparks = isCombo ? 40 : 15;
        for (let i = 0; i < numSparks; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (isCombo ? 30 : 15) + 5;
            hitParticles.push({
                type: 'spark', x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
                life: 1.0, decay: Math.random() * 0.05 + 0.02,
                color: isCombo ? pick(['#FF0000', '#FF8800', '#FFFF00', '#FFFFFF']) : pick(['#00FF00', '#FFFFFF', '#00FFFF']),
                size: Math.random() * (isCombo ? 15 : 8) + 5
            });
        }
        if (isCombo) {
            for(let i=0; i<16; i++) {
                const angle = (i / 16) * Math.PI * 2 + Math.random()*0.1;
                hitParticles.push({ type: 'line', x, y, angle, dist: 50, length: 150, life: 1.0, decay: 0.04 });
            }
        }
    }

    function createFireImpactParticles(x, y, isCombo) {
        hitParticles = [];
        hitParticles.push({
            type: 'shockwave', x, y, radius: 10,
            maxRadius: isCombo ? 650 : 350, alpha: 1.0, speed: isCombo ? 42 : 22,
            color: 'rgba(255, 70, 0, '
        });
        const numSparks = isCombo ? 55 : 28;
        for (let i = 0; i < numSparks; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (isCombo ? 30 : 18) + 4;
            hitParticles.push({
                type: 'spark', x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 1.0, decay: Math.random() * 0.04 + 0.018,
                color: Math.random() > 0.5 ? '#ff3300' : (Math.random() > 0.5 ? '#ffaa00' : '#ffffff'),
                size: Math.random() * (isCombo ? 15 : 9) + 4
            });
        }
    }

    function createFrostImpactParticles(x, y, isCombo) {
        hitParticles = [];
        hitParticles.push({
            type: 'shockwave', x, y, radius: 10,
            maxRadius: isCombo ? 650 : 350, alpha: 1.0, speed: isCombo ? 40 : 20,
            color: 'rgba(0, 229, 255, '
        });
        const numCrystals = isCombo ? 55 : 28;
        for (let i = 0; i < numCrystals; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (isCombo ? 28 : 16) + 4;
            hitParticles.push({
                type: 'crystal', x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                size: Math.random() * (isCombo ? 14 : 9) + 4,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 0.25,
                life: 1.0, decay: Math.random() * 0.03 + 0.015,
                color: Math.random() > 0.5 ? '#00e5ff' : (Math.random() > 0.5 ? '#bbf2f6' : '#ffffff')
            });
        }
    }

    function updateAndDrawParticles(ctx) {
        for (let i = hitParticles.length - 1; i >= 0; i--) {
            let p = hitParticles[i];
            if (p.type === 'shockwave') {
                p.radius += p.speed;
                p.alpha -= (p.speed / p.maxRadius);
                if (p.alpha <= 0) { hitParticles.splice(i, 1); continue; }
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
                ctx.lineWidth = 15 * p.alpha;
                ctx.strokeStyle = p.color ? (p.color + p.alpha + ')') : `rgba(255, 255, 255, ${p.alpha})`;
                ctx.shadowColor = p.color ? '#00ffff' : '#ffaa00';
                ctx.shadowBlur = 15;
                ctx.stroke();
                ctx.restore();
            } else if (p.type === 'spark') {
                p.x += p.vx; p.y += p.vy;
                p.life -= p.decay;
                if (p.life <= 0) { hitParticles.splice(i, 1); continue; }
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.fill();
                ctx.restore();
            } else if (p.type === 'crystal') {
                p.x += p.vx; p.y += p.vy;
                p.rot += p.vrot;
                p.life -= p.decay;
                if (p.life <= 0) { hitParticles.splice(i, 1); continue; }
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.beginPath();
                ctx.moveTo(0, -p.size * 1.2);
                ctx.lineTo(p.size * 0.8, 0);
                ctx.lineTo(0, p.size * 1.2);
                ctx.lineTo(-p.size * 0.8, 0);
                ctx.closePath();
                ctx.fillStyle = p.color;
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 10;
                ctx.globalAlpha = p.life;
                ctx.fill();
                ctx.restore();
            } else if (p.type === 'line') {
                p.dist += 20;
                p.life -= p.decay;
                if (p.life <= 0) { hitParticles.splice(i, 1); continue; }
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.beginPath();
                ctx.moveTo(p.dist, 0);
                ctx.lineTo(p.dist + p.length, 0);
                ctx.lineWidth = 8 * p.life;
                ctx.strokeStyle = `rgba(255, 255, 0, ${p.life})`;
                ctx.stroke();
                ctx.restore();
            }
        }
    }


    const pose = new Pose({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }});
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onResults);

    const camera = new Camera(videoElement, { onFrame: async () => { await pose.send({image: videoElement}); }, width: 1280, height: 720 });
    camera.start();
  