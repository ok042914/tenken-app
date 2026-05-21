// ===== Supabase 接続設定 =====
const SUPABASE_URL = 'https://atdnbpzssqbqxhfnlewl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0ZG5icHpzc3FicXhoZm5sZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODQ0MTEsImV4cCI6MjA5NDc2MDQxMX0.f0VETvjLh47FXbNtnQNapEFQxR_KM6jK4VETziwerJg';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 絵文字マップ =====
const ROOM_ICONS = {
  '事務所': '🪑', '事務室': '🪑',
  '電気室': '⚡', '受電室': '⚡',
  '倉庫': '📦', '材料庫': '📦', '危険物倉庫': '📦',
  'ボイラー室': '⚙️', '機械室': '⚙️', 'ポンプ室': '⚙️',
  '製造ライン1': '🔧', '製造ライン2': '🔧',
  '製造エリアA': '🔧', '製造エリアB': '🔧', '製造室': '🔧',
  '中央監視室': '🖥️',
  '休憩室': '☕', '更衣室': '☕',
  '廊下': '🚶',
  '屋上': '🌤️',
};

const EQUIP_ICONS = {
  '火災感知器': '🔥',
  '消火器': '🧯',
  '受信機': '📡',
  '防火扉': '🚪',
  '誘導灯': '💡',
  '非常放送設備': '📢',
  '屋内消火栓': '🚿',
  'スプリンクラー': '💧',
  '排煙設備': '💨',
  '非常用照明': '🔦',
  '消火ポンプ': '⛽',
  '連結送水管': '🔩',
};

function getRoomIcon(name) {
  for (const [key, icon] of Object.entries(ROOM_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return '🚪';
}

function getEquipIcon(name) {
  for (const [key, icon] of Object.entries(EQUIP_ICONS)) {
    if (name.includes(key)) return icon;
  }
  return '🔧';
}

function getNextInspectionYear(equip) {
  if (!equip.last_inspected_at) return null;
  return new Date(equip.last_inspected_at).getFullYear() + (equip.inspection_cycle_years || 1);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ===== 状態管理 =====
const state = {
  currentFactory: null,
  currentRoom: null,
  currentEquipment: null,
  currentEquipments: [],
  currentConfirmedSet: new Set(),
  planTableReady: false,
  factoryProgress: {},
  equipmentStatus: {},
};

// ===== 画面遷移 =====
const screens = ['factories', 'rooms', 'equipment', 'inspection'];

function showScreen(name) {
  screens.forEach(s => {
    document.getElementById(`screen-${s}`).classList.toggle('active', s === name);
  });
  updateHeader(name);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `tab-${tab}`)
  );
}

function updateHeader(screen) {
  const btnBack = document.getElementById('btn-back');
  const breadcrumb = document.getElementById('breadcrumb');
  const spacer = document.querySelector('.header-spacer');

  if (screen === 'factories') {
    btnBack.classList.add('hidden');
    breadcrumb.classList.add('hidden');
    spacer.style.display = '';
  } else {
    btnBack.classList.remove('hidden');
    breadcrumb.classList.remove('hidden');
    spacer.style.display = 'none';

    let parts = [];
    if (state.currentFactory) parts.push(state.currentFactory.name);
    if (screen === 'equipment' || screen === 'inspection') {
      if (state.currentRoom) parts.push(state.currentRoom.name);
    }
    if (screen === 'inspection') {
      if (state.currentEquipment) parts.push(state.currentEquipment.name);
    }
    breadcrumb.textContent = parts.join(' › ');
  }
}

document.getElementById('btn-back').addEventListener('click', () => {
  if (document.getElementById('screen-inspection').classList.contains('active')) {
    loadEquipmentScreen(state.currentRoom.id);
    showScreen('equipment');
  } else if (document.getElementById('screen-equipment').classList.contains('active')) {
    loadRoomsScreen(state.currentFactory.id);
    showScreen('rooms');
  } else if (document.getElementById('screen-rooms').classList.contains('active')) {
    showScreen('factories');
  }
});

// ===== 工場一覧 =====
async function loadFactoriesScreen() {
  const list = document.getElementById('factory-list');
  list.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: factories, error } = await db.from('factories').select('*').order('id');
  if (error) { list.innerHTML = '<div class="empty-msg">データ取得エラー</div>'; return; }

  // 進捗を一括取得
  await loadAllFactoryProgress(factories);

  list.innerHTML = '';
  factories.forEach(factory => {
    const prog = state.factoryProgress[factory.id] || { done: 0, total: 0 };
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    const isComplete = prog.total > 0 && prog.done >= prog.total;

    const card = document.createElement('div');
    card.className = 'card' + (isComplete ? ' complete' : '');
    card.innerHTML = `
      <div class="card-icon">🏢</div>
      <div class="card-title">${factory.name}</div>
      <div class="progress-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="progress-text">${prog.done}/${prog.total}項目</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.currentFactory = factory;
      loadRoomsScreen(factory.id);
      showScreen('rooms');
    });
    list.appendChild(card);
  });
}

async function loadAllFactoryProgress(factories) {
  // inspection_items の factory別集計
  const { data: items } = await db
    .from('inspection_items')
    .select('id, equipment:equipment_id(room:room_id(factory_id))');

  // inspection_results を全件取得（result が入力済みのもの）
  const { data: results } = await db
    .from('inspection_results')
    .select('inspection_item_id, result');

  const answeredSet = new Set(
    (results || []).filter(r => r.result !== null).map(r => r.inspection_item_id)
  );

  const factoryTotal = {};
  const factoryDone = {};
  factories.forEach(f => { factoryTotal[f.id] = 0; factoryDone[f.id] = 0; });

  (items || []).forEach(item => {
    const fid = item.equipment?.room?.factory_id;
    if (fid == null) return;
    factoryTotal[fid] = (factoryTotal[fid] || 0) + 1;
    if (answeredSet.has(item.id)) {
      factoryDone[fid] = (factoryDone[fid] || 0) + 1;
    }
  });

  factories.forEach(f => {
    state.factoryProgress[f.id] = {
      done: factoryDone[f.id] || 0,
      total: factoryTotal[f.id] || 0,
    };
  });
}

// ===== 部屋一覧 =====
async function loadRoomsScreen(factoryId) {
  const list = document.getElementById('room-list');
  list.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: rooms, error } = await db
    .from('rooms')
    .select('*')
    .eq('factory_id', factoryId)
    .order('id');

  if (error) { list.innerHTML = '<div class="empty-msg">データ取得エラー</div>'; return; }

  list.innerHTML = '';
  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-icon">${getRoomIcon(room.name)}</div>
      <div class="card-title">${room.name}</div>
    `;
    card.addEventListener('click', () => {
      state.currentRoom = room;
      loadEquipmentScreen(room.id);
      showScreen('equipment');
    });
    list.appendChild(card);
  });
}

// ===== 設備一覧 =====
async function loadEquipmentScreen(roomId) {
  const list = document.getElementById('equipment-list');
  const summaryBar = document.getElementById('summary-bar');
  list.innerHTML = '<div class="loading">読み込み中...</div>';
  summaryBar.classList.add('hidden');

  const { data: equipments, error } = await db
    .from('equipment')
    .select('*')
    .eq('room_id', roomId)
    .order('id');

  if (error) { list.innerHTML = '<div class="empty-msg">データ取得エラー</div>'; return; }

  const equipIds = equipments.map(e => e.id);
  await loadEquipmentStatuses(equipIds);

  const currentYear = new Date().getFullYear();
  const confirmedSet = new Set();
  if (equipIds.length > 0) {
    const { data: confirmations } = await db
      .from('inspection_results')
      .select('equipment_id')
      .in('equipment_id', equipIds)
      .eq('record_type', 'confirmation')
      .gte('confirmed_at', `${currentYear}-01-01T00:00:00.000Z`);
    (confirmations || []).forEach(c => confirmedSet.add(c.equipment_id));
  }

  let countRequired = 0, countDone = 0, countOutOfScope = 0;

  list.innerHTML = '';
  equipments.forEach(equip => {
    const nextYear = getNextInspectionYear(equip);
    const isComplete = state.equipmentStatus[equip.id] === 'complete';
    const isOutOfScope = nextYear !== null && nextYear > currentYear;

    let badgeType, badgeText;
    if (isOutOfScope) {
      badgeType = 'outofscope'; badgeText = '対象外';
      countOutOfScope++;
    } else if (isComplete) {
      badgeType = 'done'; badgeText = '完了';
      countDone++;
    } else if (nextYear !== null && nextYear < currentYear) {
      badgeType = 'overdue'; badgeText = '期限超過';
      countRequired++;
    } else {
      badgeType = 'required'; badgeText = '要点検';
      countRequired++;
    }

    const lastDateStr = equip.last_inspected_at
      ? `前回: ${formatDate(equip.last_inspected_at)}`
      : '前回: 未設定';
    const nextYearStr = nextYear !== null ? `次回: ${nextYear}年` : '次回: 未設定';
    const mgmtNo = `EQ-${String(equip.id).padStart(3, '0')}`;
    const isConfirmed = confirmedSet.has(equip.id);

    let actionHtml = '';
    if (isOutOfScope) {
      actionHtml = isConfirmed
        ? '<div class="confirmed-icon">✅ 確認済</div>'
        : `<button class="btn-confirm" data-equip-id="${equip.id}">確認済にする</button>`;
    }

    const card = document.createElement('div');
    card.className = 'card equip-card' + (isOutOfScope ? ' out-of-scope' : '');
    card.innerHTML = `
      <div class="equip-card-header">
        <div class="card-icon">${getEquipIcon(equip.name)}</div>
        <div class="equip-card-info">
          <div class="card-title">${equip.name}</div>
          <div class="equip-card-id">${mgmtNo}</div>
        </div>
        <span class="badge badge-${badgeType}">${badgeText}</span>
      </div>
      <div class="equip-card-details">
        <div class="detail-row">
          <span class="detail-label">点検周期</span>
          <span>${equip.inspection_cycle_years || 1}年周期</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">前回点検日</span>
          <span>${lastDateStr}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">次回点検予定</span>
          <span>${nextYearStr}</span>
        </div>
      </div>
      ${actionHtml}
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.btn-confirm')) return;
      state.currentEquipment = equip;
      loadInspectionScreen(equip.id);
      showScreen('inspection');
    });

    const btnConfirm = card.querySelector('.btn-confirm');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', async e => {
        e.stopPropagation();
        btnConfirm.disabled = true;
        btnConfirm.textContent = '保存中...';
        const { error: err } = await db.from('inspection_results').insert({
          equipment_id: equip.id,
          room_id: state.currentRoom.id,
          factory_id: state.currentFactory.id,
          record_type: 'confirmation',
          confirmed_at: new Date().toISOString(),
        });
        if (err) {
          btnConfirm.disabled = false;
          btnConfirm.textContent = '確認済にする';
          alert('保存に失敗しました: ' + err.message);
          return;
        }
        confirmedSet.add(equip.id);
        const div = document.createElement('div');
        div.className = 'confirmed-icon';
        div.textContent = '✅ 確認済';
        btnConfirm.replaceWith(div);
      });
    }

    list.appendChild(card);
  });

  summaryBar.innerHTML = `
    <div class="summary-item">
      <span class="summary-count">${equipments.length}</span>
      <span class="summary-label">全設備</span>
    </div>
    <div class="summary-item summary-required">
      <span class="summary-count">${countRequired}</span>
      <span class="summary-label">要点検</span>
    </div>
    <div class="summary-item summary-done">
      <span class="summary-count">${countDone}</span>
      <span class="summary-label">完了</span>
    </div>
    <div class="summary-item summary-out">
      <span class="summary-count">${countOutOfScope}</span>
      <span class="summary-label">対象外</span>
    </div>
  `;
  summaryBar.classList.remove('hidden');

  state.currentEquipments = equipments;
  state.currentConfirmedSet = confirmedSet;
  state.planTableReady = false;
  document.getElementById('plan-table-wrap').innerHTML = '';
  switchTab('list');
}

async function loadEquipmentStatuses(equipIds) {
  if (equipIds.length === 0) return;

  const { data: items } = await db
    .from('inspection_items')
    .select('id, equipment_id')
    .in('equipment_id', equipIds);

  if (!items) return;

  const itemIds = items.map(i => i.id);
  const { data: results } = await db
    .from('inspection_results')
    .select('inspection_item_id, result')
    .in('inspection_item_id', itemIds);

  const resultMap = {};
  (results || []).forEach(r => { resultMap[r.inspection_item_id] = r.result; });

  // equipment_id ごとに集計
  const byEquip = {};
  items.forEach(item => {
    if (!byEquip[item.equipment_id]) byEquip[item.equipment_id] = [];
    byEquip[item.equipment_id].push(item.id);
  });

  equipIds.forEach(eid => {
    const itemList = byEquip[eid] || [];
    if (itemList.length === 0) { state.equipmentStatus[eid] = null; return; }
    const answered = itemList.filter(id => resultMap[id] != null);
    const hasNG = itemList.some(id => resultMap[id] === 'NG');
    if (hasNG) state.equipmentStatus[eid] = 'ng';
    else if (answered.length === itemList.length) state.equipmentStatus[eid] = 'complete';
    else state.equipmentStatus[eid] = 'partial';
  });
}

// ===== 計画表 =====
const PLAN_OFFSET = 3;

function isTargetYear(equip, year) {
  const cycle = equip.inspection_cycle_years || 1;
  if (!equip.last_inspected_at) return true;
  const baseYear = new Date(equip.last_inspected_at).getFullYear();
  return Math.abs(year - baseYear) % cycle === 0;
}

function getCellInfo(equip, year, currentYear, isComplete, isConfirmed) {
  if (!isTargetYear(equip, year)) return { type: 'empty' };
  const baseYear = equip.last_inspected_at
    ? new Date(equip.last_inspected_at).getFullYear()
    : null;
  if (baseYear !== null && year <= baseYear) return { type: 'done' };
  if (year > currentYear) return { type: 'future' };
  if (year === currentYear) {
    if (isComplete) return { type: 'done' };
    if (isConfirmed) return { type: 'confirmed' };
    return { type: 'required' };
  }
  return { type: 'overdue' };
}

function renderPlanTable(equipments, confirmedSet, currentYear) {
  const wrap = document.getElementById('plan-table-wrap');
  const years = [];
  for (let y = currentYear - PLAN_OFFSET; y <= currentYear + PLAN_OFFSET; y++) years.push(y);

  const table = document.createElement('table');
  table.className = 'plan-table';

  // ヘッダー行
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const thE = document.createElement('th');
  thE.className = 'plan-th-equip';
  thE.textContent = '設備';
  hr.appendChild(thE);
  years.forEach(y => {
    const th = document.createElement('th');
    th.className = 'plan-th-year' + (y === currentYear ? ' plan-col-current' : '');
    th.innerHTML = y === currentYear
      ? `${y}<br><span class="plan-today-label">← 今年</span>`
      : String(y);
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  // データ行
  const tbody = document.createElement('tbody');
  equipments.forEach(equip => {
    const tr = document.createElement('tr');
    const tdE = document.createElement('td');
    tdE.className = 'plan-td-equip';
    tdE.innerHTML = `<div class="plan-equip-name">${equip.name}</div><div class="plan-equip-id">EQ-${String(equip.id).padStart(3, '0')}</div>`;
    tr.appendChild(tdE);

    const isComplete = state.equipmentStatus[equip.id] === 'complete';
    const isConfirmed = confirmedSet.has(equip.id);

    years.forEach(y => {
      const td = document.createElement('td');
      td.className = 'plan-td-cell' + (y === currentYear ? ' plan-col-current' : '');
      const info = getCellInfo(equip, y, currentYear, isComplete, isConfirmed);

      if (info.type === 'done') {
        td.innerHTML = '<span class="plan-cell-done">●</span>';
        td.classList.add('plan-cell-tappable');
        td.addEventListener('click', () => showDetailModal(equip));
      } else if (info.type === 'required') {
        td.innerHTML = '<span class="plan-cell-required">◉</span>';
        td.classList.add('plan-cell-tappable');
        td.addEventListener('click', () => {
          state.currentEquipment = equip;
          loadInspectionScreen(equip.id);
          showScreen('inspection');
        });
      } else if (info.type === 'confirmed') {
        td.innerHTML = '<span class="plan-cell-confirmed">✓</span>';
      } else if (info.type === 'future') {
        td.innerHTML = '<span class="plan-cell-future">○</span>';
      } else if (info.type === 'overdue') {
        td.classList.add('plan-cell-overdue-bg');
        td.innerHTML = '<span class="plan-cell-overdue">⚠</span>';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.innerHTML = '';
  wrap.appendChild(table);
}

async function showDetailModal(equip) {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('modal-content');
  content.innerHTML = '<div class="loading">読み込み中...</div>';
  modal.classList.remove('hidden');

  const { data: items } = await db
    .from('inspection_items')
    .select('id, item_name')
    .eq('equipment_id', equip.id);

  const itemIds = (items || []).map(i => i.id);
  let results = [];
  if (itemIds.length > 0) {
    const { data: r } = await db
      .from('inspection_results')
      .select('inspection_item_id, result, comment')
      .in('inspection_item_id', itemIds);
    results = r || [];
  }
  const resultMap = {};
  results.forEach(r => { resultMap[r.inspection_item_id] = r; });

  const lastDate = equip.last_inspected_at ? formatDate(equip.last_inspected_at) : '未設定';
  const itemRows = (items || []).map(item => {
    const r = resultMap[item.id];
    const result = r?.result || '-';
    const comment = r?.comment ? `<div class="modal-item-comment">${r.comment}</div>` : '';
    return `<div class="modal-item-row">
      <span class="modal-item-name">${item.item_name}</span>
      <span class="modal-item-result ${result === 'OK' ? 'result-ok' : result === 'NG' ? 'result-ng' : ''}">${result}</span>
      ${comment}
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="modal-equip-header">
      <span class="modal-equip-icon">${getEquipIcon(equip.name)}</span>
      <div>
        <div class="modal-equip-name">${equip.name}</div>
        <div class="modal-equip-id">EQ-${String(equip.id).padStart(3, '0')}</div>
      </div>
    </div>
    <div class="modal-meta">
      <div class="modal-meta-row"><span>前回点検日</span><span>${lastDate}</span></div>
      <div class="modal-meta-row"><span>点検周期</span><span>${equip.inspection_cycle_years || 1}年</span></div>
    </div>
    <div class="modal-items-title">点検項目</div>
    <div class="modal-items">${itemRows || '<div class="empty-msg">項目なし</div>'}</div>
  `;
}

// ===== 点検入力 =====
let inspectionData = {}; // itemId -> { result, comment }

async function loadInspectionScreen(equipmentId) {
  const form = document.getElementById('inspection-form');
  const saveStatus = document.getElementById('save-status');
  saveStatus.textContent = '';
  form.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: items, error } = await db
    .from('inspection_items')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('id');

  if (error) { form.innerHTML = '<div class="empty-msg">データ取得エラー</div>'; return; }

  // 既存の結果を取得
  const itemIds = items.map(i => i.id);
  const { data: existing } = await db
    .from('inspection_results')
    .select('*')
    .in('inspection_item_id', itemIds);

  inspectionData = {};
  (existing || []).forEach(r => {
    inspectionData[r.inspection_item_id] = { result: r.result, comment: r.comment || '' };
  });

  form.innerHTML = '';
  items.forEach(item => {
    const saved = inspectionData[item.id] || { result: null, comment: '' };
    const card = document.createElement('div');
    card.className = 'inspection-item-card';
    card.innerHTML = `
      <div class="item-name">${item.item_name}</div>
      <div class="result-buttons">
        <button class="btn-ok${saved.result === 'OK' ? ' selected' : ''}" data-id="${item.id}" data-val="OK">OK</button>
        <button class="btn-ng${saved.result === 'NG' ? ' selected' : ''}" data-id="${item.id}" data-val="NG">NG</button>
      </div>
      <textarea class="comment-input" data-id="${item.id}" placeholder="コメント（任意）" rows="2">${saved.comment}</textarea>
    `;
    form.appendChild(card);

    // ボタンイベント
    card.querySelectorAll('.btn-ok, .btn-ng').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const val = btn.dataset.val;
        const prev = inspectionData[id]?.result;
        if (!inspectionData[id]) inspectionData[id] = { result: null, comment: '' };
        inspectionData[id].result = (prev === val) ? null : val;

        // 同じカード内のボタンを更新
        const btns = card.querySelectorAll('.btn-ok, .btn-ng');
        btns.forEach(b => b.classList.remove('selected'));
        if (inspectionData[id].result) {
          card.querySelector(`[data-val="${inspectionData[id].result}"]`).classList.add('selected');
        }
      });
    });

    // コメントイベント
    card.querySelector('.comment-input').addEventListener('input', e => {
      const id = parseInt(e.target.dataset.id);
      if (!inspectionData[id]) inspectionData[id] = { result: null, comment: '' };
      inspectionData[id].comment = e.target.value;
    });
  });
}

// ===== 保存 =====
document.getElementById('btn-save').addEventListener('click', async () => {
  const saveStatus = document.getElementById('save-status');
  saveStatus.textContent = '保存中...';
  saveStatus.className = 'save-status';

  const now = new Date().toISOString();
  const upserts = Object.entries(inspectionData).map(([itemId, data]) => ({
    inspection_item_id: parseInt(itemId),
    result: data.result,
    comment: data.comment || '',
    updated_at: now,
  }));

  if (upserts.length === 0) {
    saveStatus.textContent = '入力項目がありません';
    saveStatus.className = 'save-status error';
    return;
  }

  // upsert: inspection_item_id をキーにして更新または挿入
  const { error } = await db
    .from('inspection_results')
    .upsert(upserts, { onConflict: 'inspection_item_id' });

  if (error) {
    saveStatus.textContent = '保存失敗: ' + error.message;
    saveStatus.className = 'save-status error';
    return;
  }

  saveStatus.textContent = '✅ 保存しました';
  saveStatus.className = 'save-status success';

  // 設備・工場の進捗キャッシュをクリア
  state.equipmentStatus = {};
  state.factoryProgress = {};

  setTimeout(() => { saveStatus.textContent = ''; }, 3000);
});

// ===== 初期化 =====
(async function init() {
  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (tab === 'plan' && !state.planTableReady && state.currentEquipments.length > 0) {
        renderPlanTable(state.currentEquipments, state.currentConfirmedSet, new Date().getFullYear());
        state.planTableReady = true;
      }
    });
  });

  // モーダル閉じる
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.add('hidden');
  });
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('detail-modal').classList.add('hidden');
  });

  await loadFactoriesScreen();
  showScreen('factories');
})();
