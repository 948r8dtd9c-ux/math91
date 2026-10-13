(() => {
  'use strict';

  const TASK_COUNT = 91;
  const PROGRESS_KEY = 'math91.progress.v1';
  const THEME_KEY = 'math91.theme';
  const $ = (id) => document.getElementById(id);

  function validateChecks(value) {
    if (!Array.isArray(value) || value.length !== TASK_COUNT || !value.every((row) => Array.isArray(row) && row.length === 2 && row.every((v) => typeof v === 'boolean'))) {
      throw new Error('チェックデータの形式が正しくありません。');
    }
    return value.map((row) => [...row]);
  }

  function loadChecks() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? validateChecks(JSON.parse(raw).checks) : Array.from({ length: TASK_COUNT }, () => [false, false]);
    } catch (error) {
      console.warn('進捗を読み込めませんでした:', error);
      return Array.from({ length: TASK_COUNT }, () => [false, false]);
    }
  }

  let checks = loadChecks();
  let activeFilter = 'all';
  let activeRange = 'all';
  let toastTimer;

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3000);
  }

  function persist() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, checks, updatedAt: new Date().toISOString() }));
    } catch (error) {
      console.error('端末内への保存に失敗:', error);
      toast('保存できませんでした。ブラウザのストレージ設定を確認してください。');
    }
  }

  function totals() {
    const first = checks.reduce((sum, row) => sum + Number(row[0]), 0);
    const second = checks.reduce((sum, row) => sum + Number(row[1]), 0);
    const fully = checks.reduce((sum, row) => sum + Number(row[0] && row[1]), 0);
    return { first, second, fully, checked: first + second };
  }

  function updateSummary() {
    const { first, second, fully, checked } = totals();
    const percent = Math.round((checked / (TASK_COUNT * 2)) * 100);
    $('total-percent').textContent = percent;
    $('total-checked').textContent = `${checked} / ${TASK_COUNT * 2} チェック完了`;
    $('fully-complete').textContent = `2周完了 ${fully} / ${TASK_COUNT}題`;
    $('round-one-count').textContent = `${first} / ${TASK_COUNT}`;
    $('round-two-count').textContent = `${second} / ${TASK_COUNT}`;
    $('total-fill').style.width = `${(checked / (TASK_COUNT * 2)) * 100}%`;
    $('round-one-fill').style.width = `${(first / TASK_COUNT) * 100}%`;
    $('round-two-fill').style.width = `${(second / TASK_COUNT) * 100}%`;
    $('total-progress-bar').setAttribute('aria-valuenow', String(checked));
    $('total-progress-bar').setAttribute('aria-valuetext', `${percent}%、${checked} / ${TASK_COUNT * 2} チェック完了`);
    $('next-button').disabled = fully === TASK_COUNT;
  }

  function rangeIncludes(number) {
    if (activeRange === 'all') return true;
    const [min, max] = activeRange.split('-').map(Number);
    return number >= min && number <= max;
  }

  function matchesFilter(number) {
    const done = checks[number - 1].every(Boolean);
    return activeFilter === 'all' || (activeFilter === 'done' ? done : !done);
  }

  function makeTask(number) {
    const completed = checks[number - 1];
    const task = document.createElement('article');
    task.className = `task${completed.every(Boolean) ? ' is-done' : ''}`;
    task.id = `task-${number}`;

    const left = document.createElement('div');
    left.className = 'task-left';
    left.innerHTML = `<span class="task-number">${String(number).padStart(2, '0')}</span><span class="task-name">問題 ${number}</span><span class="task-done-icon" aria-label="2周完了">✓</span>`;

    const group = document.createElement('div');
    group.className = 'check-group';
    for (let round = 0; round < 2; round++) {
      const label = document.createElement('label');
      label.className = 'check-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = completed[round];
      input.setAttribute('aria-label', `問題${number} ${round + 1}周目`);
      input.dataset.number = String(number);
      input.dataset.round = String(round);
      const caption = document.createElement('span');
      caption.textContent = `${round + 1}周目`;
      label.append(input, caption);
      group.appendChild(label);
    }
    task.append(left, group);
    return task;
  }

  function renderList() {
    const nodes = [];
    for (let n = 1; n <= TASK_COUNT; n++) {
      if (rangeIncludes(n) && matchesFilter(n)) nodes.push(makeTask(n));
    }
    $('checklist').replaceChildren(...nodes);
    $('visible-count').textContent = `${nodes.length}件を表示`;
    $('empty-state').hidden = nodes.length !== 0;
    $('empty-message').textContent = activeFilter === 'todo' ? 'この範囲の問題はすべて2周完了しています！' : 'この条件に一致する問題はありません。';
  }

  function refreshTask(number) {
    const el = $(`task-${number}`);
    if (!el) return;
    if (activeFilter !== 'all') {
      renderList();
    } else {
      const done = checks[number - 1].every(Boolean);
      el.classList.toggle('is-done', done);
    }
  }

  $('checklist').addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const number = Number(input.dataset.number);
    const round = Number(input.dataset.round);
    if (!Number.isInteger(number) || number < 1 || number > TASK_COUNT || ![0, 1].includes(round)) return;
    checks[number - 1][round] = input.checked;
    persist();
    updateSummary();
    refreshTask(number);
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((other) => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      renderList();
    });
  });

  $('range-select').addEventListener('change', (event) => {
    activeRange = event.target.value;
    renderList();
  });

  function showAll() {
    activeFilter = 'all';
    activeRange = 'all';
    $('range-select').value = 'all';
    document.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderList();
  }

  $('clear-filters').addEventListener('click', showAll);

  $('next-button').addEventListener('click', () => {
    const firstIncomplete = checks.findIndex((row) => !row.every(Boolean));
    if (firstIncomplete === -1) return;
    const number = firstIncomplete + 1;
    if (!rangeIncludes(number) || !matchesFilter(number)) showAll();
    const task = $(`task-${number}`);
    if (!task) return;
    task.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
    $('theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1220' : '#f6f7fb');
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  }

  $('theme-toggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  $('export-button').addEventListener('click', () => {
    const payload = JSON.stringify({ app: 'math91', version: 1, checks, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `math91-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('バックアップファイルを作成しました。');
  });

  $('import-button').addEventListener('click', () => $('import-input').click());
  $('import-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('ファイルが大きすぎます。');
      const payload = JSON.parse(await file.text());
      if (payload.app !== 'math91' || payload.version !== 1) throw new Error('数学91のバックアップファイルを選択してください。');
      const imported = validateChecks(payload.checks);
      if (!window.confirm('現在のチェック状態をバックアップの内容で上書きします。よろしいですか？')) return;
      checks = imported;
      persist();
      updateSummary();
      renderList();
      toast('バックアップを復元しました。');
    } catch (error) {
      toast(error.message || 'バックアップの読み込みに失敗しました。');
    } finally {
      event.target.value = '';
    }
  });

  $('reset-button').addEventListener('click', () => {
    if (!window.confirm('91題×2周のチェックをすべて消去します。この操作は取り消せません。よろしいですか？')) return;
    checks = Array.from({ length: TASK_COUNT }, () => [false, false]);
    persist();
    updateSummary();
    renderList();
    toast('すべてのチェックをリセットしました。');
  });

  setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  updateSummary();
  renderList();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
        console.warn('オフライン機能を登録できませんでした:', error);
      });
    });
  }
})();
