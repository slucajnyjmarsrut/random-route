/* Marshik's contextual one-step-at-a-time walking guide.
 * UI only: never grants GPS/photo/route progress and never intercepts actions.
 */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const stageKey = 'rr_marshik_creator_stage_v41';
  const guideId = 'rrMarshikGuide';
  let creatorStage = 0;
  try { creatorStage = Math.max(0, Math.min(2, Number(sessionStorage.getItem(stageKey)) || 0)); } catch (_) {}
  let activeKey = '', activeTarget = null, previousDescription = null, guide = null, queued = false;

  function setCreatorStage(value) {
    creatorStage = Math.max(0, Math.min(2, value));
    try { sessionStorage.setItem(stageKey, String(creatorStage)); } catch (_) {}
    schedule();
  }

  const shown = element => !!element && !element.classList.contains('hidden') &&
    !element.closest('.hidden') && getComputedStyle(element).display !== 'none';

  function chooseStep() {
    const app = $('.app');
    if (!app || $('#profileAuthModal')?.classList.contains('show')) return null;
    const screen = app.dataset.rrScreen;
    if (screen === 'create') {
      if (creatorStage === 0) return {
        key:'create:distance', target:'.rr-distance-options', anchor:'.rr-distance-options',
        heading:'Шаг 1 · Длина прогулки',
        message:'Выбери, сколько километров хочешь пройти. Я покажу следующий шаг.'
      };
      if (creatorStage === 1) return {
        key:'create:interest', target:'#typeChoices', anchor:'#typeChoices',
        heading:'Шаг 2 · Что посмотрим?',
        message:'Нажми на парки, памятники или природу. Затем я подскажу, как стартовать.'
      };
      const demo = shown($('#demoGpsBtn'));
      const gpsReady = $('#yakutskLocationStatus')?.classList.contains('ok') &&
        !/за пределами/i.test($('#yakutskLocationStatus')?.textContent || '');
      if (!demo && !gpsReady) {
        if (!$('#rrStartSettings')?.open) return {
          key:'create:gps', target:'#rrStartSettings > summary', anchor:'#rrStartSettings',
          heading:'Нужно уточнить место старта',
          message:'Раскрой «Местоположение и GPS», чтобы обновить координаты или выбрать пробный маршрут.'
        };
        return {
          key:'create:gps-action', target:'#locateYakutskBtn', anchor:'.rr-create-gps-actions',
          heading:'Выбираем точку старта',
          message:'Обнови GPS или нажми «Пробный маршрут без GPS». После этого можно строить прогулку.'
        };
      }
      if ($('#routeBuildStatus')?.dataset.state==='error') return {
        key:'create:error', target:'#buildBtn', anchor:'#buildBtn',
        heading:'Маршрут пока не готов',
        message:$('#routeBuildStatus')?.dataset.errorCode==='osm'
          ?'Не удалось загрузить пешеходные дороги. Нажми «Повторить построение». Если ошибка останется — проверь интернет и попробуй позже.'
          :'Маршрут не построен. Выбери другую дистанцию или нажми «Повторить построение».'
      };
      if ($('#buildBtn')?.disabled) return {
        key:'create:building', target:'#buildBtn', anchor:'#buildBtn', spotlight:false,
        heading:'Маршик строит прогулку',
        message:'Подбираем пешеходный путь. Подсказка сменится, когда маршрут будет готов.'
      };
      return {
        key:'create:build', target:'#buildBtn', anchor:'#buildBtn',
        heading:'Шаг 3 · Всё готово!',
        message:'Нажми «Построить прогулку» — дальше я покажу путь на карте.'
      };
    }
    if (screen !== 'route') return null;
    const gpsText = $('#gpsCheck b')?.textContent || '';
    const buttonText = $('#gpsBtn')?.textContent || '';
    if (/Финиш подтверждён/i.test(gpsText)) return {
      key:'route:done', target:'#checkpointTitle', anchor:'#checkpointTitle', spotlight:false, done:true,
      heading:'Ура! Прогулка завершена',
      message:'Маршрут пройден! Результаты можно посмотреть в профиле в нижнем меню.'
    };
    if (/Подтвердить возвращение к старту/i.test(buttonText)) return {
      key:'route:finish', target:'#gpsBtn', anchor:'#gpsBtn',
      heading:'Последний шаг · Финиш',
      message:'Вернись к точке старта и подтверди возвращение через GPS.'
    };
    if (shown($('#nextBtn'))) return {
      key:'route:next', target:'#nextBtn', anchor:'#nextBtn',
      heading:'Следующий участок открыт',
      message:'Нажми «Продолжить», чтобы я показал следующую часть маршрута.'
    };
    if (shown($('#photoBlock'))) {
      if (shown($('#verifyBtn'))) return {
        key:'route:verify', target:'#verifyBtn', anchor:'#verifyBtn',
        heading:'Фото готово к проверке',
        message:'Нажми «Проверить фото». Если снимок не совпадёт, попробуй ещё раз.'
      };
      return {
        key:'route:photo', target:'#photoBlock .photo-camera-btn', anchor:'#photoBlock .photo-camera-btn',
        heading:'Теперь фотозадание',
        message:'Сверь объект с примером. Нажми «Сфотографировать объект» и сделай снимок с безопасного места.'
      };
    }
    if (shown($('#demoGpsBtn'))) return {
      key:'route:demo-arrival', target:'#demoGpsBtn', anchor:'#demoGpsBtn',
      heading:'Пробная прогулка',
      message:'Посмотри путь на карте. Чтобы проверить следующий шаг без GPS, нажми «Тест: имитировать прибытие».'
    };
    return {
      key:'route:walk', target:'#rrNavPanel', anchor:'.rr-route-map-layout',
      heading:'Идём к контрольной точке',
      message:'Следуй по линии на карте. У точки нажми «Проверить GPS» или дождись автоматической проверки.'
    };
  }

  function clearStep() {
    if (activeTarget) {
      activeTarget.classList.remove('rr-marshik-current-target');
      if (previousDescription === null) activeTarget.removeAttribute('aria-describedby');
      else activeTarget.setAttribute('aria-describedby', previousDescription);
    }
    if (guide) guide.remove();
    guide = null;
    activeTarget = null;
    previousDescription = null;
    activeKey = '';
  }

  function render() {
    const step = chooseStep();
    if (!step) { if (activeKey) clearStep(); return; }
    const target = $(step.target), anchor = $(step.anchor);
    if (!target || !anchor || !shown(target)) { if (activeKey) clearStep(); return; }
    if (step.key === activeKey && target === activeTarget && guide?.isConnected) return;
    clearStep();
    guide = document.createElement('aside');
    guide.id = guideId;
    guide.className = 'rr-marshik-step' + (step.done ? ' rr-marshik-step-done' : '');
    guide.dataset.rrGuideStep = step.key;
    guide.setAttribute('role', 'status');
    guide.setAttribute('aria-live', 'polite');

    const img = document.createElement('img');
    img.src = 'icons/mascot-marshik.svg';
    img.alt = '';
    img.width = 58;
    img.height = 62;
    img.setAttribute('aria-hidden', 'true');
    const bubble = document.createElement('div');
    bubble.className = 'rr-marshik-step-bubble';
    const heading = document.createElement('strong');
    heading.textContent = '🐾 Маршик · ' + step.heading;
    const message = document.createElement('p');
    message.id = 'rrMarshikGuideText';
    message.textContent = step.message;
    bubble.append(heading, message);
    guide.append(img, bubble);
    if (!step.done) {
      const arrow = document.createElement('span');
      arrow.className = 'rr-marshik-step-arrow';
      arrow.textContent = '↓';
      arrow.setAttribute('aria-hidden', 'true');
      guide.append(arrow);
    }
    anchor.before(guide);
    activeTarget = target;
    activeKey = step.key;
    if (step.spotlight !== false) {
      target.classList.add('rr-marshik-current-target');
      previousDescription = target.getAttribute('aria-describedby');
      target.setAttribute('aria-describedby', [previousDescription, message.id].filter(Boolean).join(' '));
    }
    // Do not hide a newly generated photo task or the next section below the fold.
    // Walking instructions remain near the map; no forced scrolling during GPS tracking.
    if (step.key.startsWith('create:') || /route:(photo|verify|next|finish)/.test(step.key)) {
      const motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        if (activeKey !== step.key || !target.isConnected) return;
        const rect = target.getBoundingClientRect(), nav = $('.nav')?.getBoundingClientRect();
        const bottom = nav ? nav.top - 16 : innerHeight - 16;
        if (rect.top < 76 || rect.bottom > bottom) target.scrollIntoView({
          behavior: motionReduced ? 'auto' : 'smooth', block: 'nearest'
        });
      });
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'homeOpenCreateBtn') setCreatorStage(0);
    else if (button.matches('[data-distance-km]')) {
      if (creatorStage < 1) setCreatorStage(1);
    } else if (button.closest('#typeChoices')) {
      if (creatorStage < 2) setCreatorStage(2);
    }
    schedule();
  });
  $('#distanceInput')?.addEventListener('change', () => {
    if (creatorStage < 1) setCreatorStage(1);
  });
  const watch = (selector, config) => {
    const node = $(selector);
    if (node) new MutationObserver(schedule).observe(node, config);
  };
  watch('.app', {attributes:true, attributeFilter:['data-rr-screen']});
  watch('#rrStartSettings', {attributes:true, attributeFilter:['open']});
  watch('#routeBuildStatus', {attributes:true, attributeFilter:['hidden','data-state','data-error-code']});
  ['#home','#create','#route','#profileAuthModal','#photoBlock','#verifyBtn',
   '#nextBtn','#demoGpsBtn','#buildBtn','#gpsCheck','#photoCheck'].forEach(selector =>
    watch(selector, {attributes:true, attributeFilter:['class','disabled']})
  );
  ['#gpsBtn','#gpsCheck b','#yakutskLocationStatus'].forEach(selector =>
    watch(selector, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class']})
  );
  document.addEventListener('rr:marshik-refresh', schedule);
  window.RRMarshikGuide = Object.freeze({refresh:schedule});
  schedule();
})();
