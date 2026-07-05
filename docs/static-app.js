    // ===== 靜態版設定（已寫好，免再改）=====
    const CONFIG = {
      PASSWORD: '12345',
      EMAIL_TO: 'ben83127@gmail.com',
    };

    const ROSTER_KEY = 'rollcall_roster_v1';
    const DEFAULT_ROSTER = __PLAYERS_JSON__;

    const STATUSES = [
      { key: 'present', label: '實到', head: 'bg-emerald-100 text-emerald-900', col: 'bg-emerald-50/80', btn: 'border-emerald-300 text-emerald-600', active: 'bg-emerald-600 border-emerald-700 text-white' },
      { key: 'late', label: '遲到', head: 'bg-amber-100 text-amber-900', col: 'bg-amber-50/80', btn: 'border-amber-300 text-amber-600', active: 'bg-amber-500 border-amber-600 text-white' },
      { key: 'competition', label: '比賽', head: 'bg-blue-100 text-blue-900', col: 'bg-blue-50/80', btn: 'border-blue-300 text-blue-600', active: 'bg-blue-600 border-blue-700 text-white' },
      { key: 'leave', label: '請假', head: 'bg-violet-100 text-violet-900', col: 'bg-violet-50/80', btn: 'border-violet-300 text-violet-600', active: 'bg-violet-600 border-violet-700 text-white' },
      { key: 'absent', label: '無故未到', head: 'bg-red-100 text-red-900', col: 'bg-red-50/80', btn: 'border-red-300 text-red-600', active: 'bg-red-600 border-red-700 text-white' },
    ];

    let adminToken = localStorage.getItem('adminToken') || '';
    let roster = [];
    const attendance = new Map();
    const notesMap = new Map();
    let openMenuId = null;

    const $ = (id) => document.getElementById(id);

    function loadRosterFromStorage() {
      try {
        const saved = localStorage.getItem(ROSTER_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) { /* ignore */ }
      return DEFAULT_ROSTER.map((p) => ({ ...p }));
    }

    function saveRosterToStorage() {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    }

    function nextPlayerId() {
      if (roster.length === 0) return 1;
      return Math.max(...roster.map((p) => Number(p.id) || 0)) + 1;
    }

    function todayStr() {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
    }

    function nowStr() {
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(new Date());
    }

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function showMain() {
      $('login-panel').classList.add('hidden');
      $('main-panel').classList.remove('hidden');
      $('today-label').textContent = `今日：${todayStr()}`;
      loadPlayers();
    }

    function tryLogin() {
      adminToken = $('token-input').value.trim();
      if (adminToken !== CONFIG.PASSWORD) {
        alert('密碼錯誤');
        return;
      }
      localStorage.setItem('adminToken', adminToken);
      showMain();
    }

    function closeAllMenus() {
      openMenuId = null;
      document.querySelectorAll('.menu-panel').forEach((el) => el.classList.add('hidden'));
    }

    function toggleMenu(id, event) {
      event.stopPropagation();
      const panel = document.getElementById(`menu-${id}`);
      if (openMenuId === id) {
        closeAllMenus();
        return;
      }
      closeAllMenus();
      openMenuId = id;
      panel.classList.remove('hidden');
    }

    function setStatus(playerId, status) {
      attendance.set(playerId, status);
      renderTable();
    }

    function saveNote(playerId, value) {
      notesMap.set(playerId, value);
      const player = roster.find((p) => p.id === playerId);
      if (player) {
        player.notes = value;
        saveRosterToStorage();
      }
    }

    window.saveNote = (id, el) => saveNote(id, el.value);
    window.toggleMenu = toggleMenu;
    window.setStatus = setStatus;

    window.editPlayer = (id) => {
      closeAllMenus();
      openForm(roster.find((p) => p.id === id));
    };

    window.deletePlayer = (id) => {
      closeAllMenus();
      if (!confirm('確定刪除此隊員？')) return;
      roster = roster.filter((p) => p.id !== id);
      attendance.delete(id);
      notesMap.delete(id);
      saveRosterToStorage();
      renderTable();
    };

    function openForm(player = null) {
      closeAllMenus();
      $('form-title').textContent = player ? '編輯隊員' : '新增隊員';
      $('edit-id').value = player?.id || '';
      const form = $('player-form');
      for (const el of form.elements) {
        if (el.name) el.value = player ? (player[el.name] || '') : '';
      }
      $('form-modal').classList.remove('hidden');
    }

    function renderTable() {
      let html = `<table class="w-full text-sm min-w-[980px] border-collapse"><thead class="text-slate-700">
        <tr class="label-row">
          <th class="p-2 text-left bg-slate-50">操作</th>
          <th class="p-2 text-left col-sticky-name bg-slate-50">姓名</th>
          <th class="p-2 text-left bg-slate-50">班級</th>
          <th class="p-2 text-left bg-slate-50">家長電話</th>
          <th class="p-2 text-left bg-slate-50 min-w-[140px]">備註</th>`;
      for (const s of STATUSES) {
        html += `<th class="p-2 text-center ${s.head}">
          <div class="text-base leading-none mb-0.5">○</div>
          <div class="font-bold whitespace-nowrap">${s.label}</div>
        </th>`;
      }
      html += `</tr></thead><tbody>`;

      if (roster.length === 0) {
        html += `<tr><td colspan="10" class="p-6 text-center text-slate-400">尚無隊員資料</td></tr>`;
      }

      for (const p of roster) {
        const current = attendance.get(p.id) || '';
        const noteVal = esc(notesMap.get(p.id) ?? p.notes ?? '');
        html += `<tr class="border-t align-middle hover:bg-slate-50/50">
          <td class="p-2 relative bg-white">
            <button type="button" onclick="toggleMenu(${p.id}, event)" class="border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 bg-white hover:bg-slate-50">操作</button>
            <div id="menu-${p.id}" class="menu-panel hidden absolute left-2 top-12 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <button type="button" onclick="editPlayer(${p.id})" class="block w-full text-left px-4 py-2 hover:bg-slate-50 text-emerald-700">編輯</button>
              <button type="button" onclick="deletePlayer(${p.id})" class="block w-full text-left px-4 py-2 hover:bg-slate-50 text-red-600">刪除</button>
            </div>
          </td>
          <td class="p-3 font-semibold col-sticky-name bg-white">${esc(p.name)}</td>
          <td class="p-3 bg-white">${esc(p.grade)}</td>
          <td class="p-3 whitespace-nowrap bg-white">${esc(p.parent_phone)}</td>
          <td class="p-2 bg-white">
            <input type="text" value="${noteVal}" placeholder="有問題可填寫"
              class="w-full min-w-[120px] border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
              onblur="saveNote(${p.id}, this)" onclick="event.stopPropagation()">
          </td>`;

        for (const s of STATUSES) {
          const active = current === s.key;
          html += `<td class="p-2 text-center ${s.col}">
            <button type="button"
              class="status-btn ${active ? s.active : s.btn}"
              title="${s.label}"
              onclick="setStatus(${p.id}, '${s.key}')">${active ? '●' : '○'}</button>
          </td>`;
        }
        html += `</tr>`;
      }

      html += '</tbody></table>';
      $('player-table').innerHTML = html;
    }

    function loadPlayers() {
      roster = loadRosterFromStorage().filter((p) => p.is_active !== false && p.name);
      for (const p of roster) {
        if (!attendance.has(p.id)) attendance.set(p.id, '');
        if (!notesMap.has(p.id)) notesMap.set(p.id, p.notes || '');
      }
      renderTable();
    }

    function buildSummary(records) {
      const summary = { present: 0, late: 0, competition: 0, leave: 0, absent: 0 };
      for (const r of records) {
        if (summary[r.status] !== undefined) summary[r.status]++;
      }
      return summary;
    }

    function buildEmailHtml(date, submittedAt, records) {
      const summary = buildSummary(records);
      const rows = records.map((r) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eee;">${esc(r.name)}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${esc(r.grade || '-')}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'present' ? '●' : '○'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'late' ? '●' : '○'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'competition' ? '●' : '○'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'leave' ? '●' : '○'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'absent' ? '●' : '○'}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${esc(r.parent_phone || '')}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;">${esc(r.notes || '')}</td>
        </tr>`).join('');

      const absentList = records.filter((r) => r.status === 'absent');
      let absentPhones = '';
      if (absentList.length) {
        absentPhones = '<h3 style="color:#dc2626;margin-top:24px">無故未到 · 家長聯絡電話</h3><ul>' +
          absentList.map((r) => `<li><strong>${esc(r.name)}</strong>：${esc(r.parent_phone || '（未填）')}</li>`).join('') +
          '</ul>';
      }

      return `
<div style="font-family:sans-serif;max-width:900px">
  <div style="background:#047857;color:#fff;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0 0 8px;font-size:22px">中山國小桌球隊點名表</h1>
    <p style="margin:0">日期：${esc(date)}</p>
    <p style="margin:8px 0 0">送出時間：${esc(submittedAt)}</p>
  </div>
  <div style="padding:20px 24px;background:#fff;border:1px solid #e2e8f0;border-top:0">
    <p style="color:#475569">○實到　○遲到　○比賽　○請假　○無故未到（●為該生今日狀態）</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px;text-align:left">姓名</th><th style="padding:10px;text-align:left">班級</th>
        <th style="padding:10px;text-align:center">○實到</th><th style="padding:10px;text-align:center">○遲到</th>
        <th style="padding:10px;text-align:center">○比賽</th><th style="padding:10px;text-align:center">○請假</th>
        <th style="padding:10px;text-align:center">○無故未到</th><th style="padding:10px;text-align:left">家長電話</th>
        <th style="padding:10px;text-align:left">備註</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0">實到 ${summary.present} 人 · 遲到 ${summary.late} 人 · 比賽 ${summary.competition} 人 · 請假 ${summary.leave} 人 · 無故未到 ${summary.absent} 人</p>
    ${absentPhones}
  </div>
</div>`.trim();
    }

    async function submitRollcall() {
      $('submit-status').classList.add('hidden');
      const missing = roster.filter((p) => !attendance.get(p.id));
      if (missing.length) {
        alert(`尚有 ${missing.length} 位隊員未選擇狀態，請每位各選一項 ○`);
        return;
      }

      const date = todayStr();
      const submittedAt = nowStr();
      const records = roster.map((p) => ({
        playerId: p.id,
        name: p.name,
        grade: p.grade || '',
        status: attendance.get(p.id),
        parent_phone: p.parent_phone || '',
        notes: notesMap.get(p.id) ?? p.notes ?? '',
      }));

      const summary = buildSummary(records);
      const subject = `[點名表] ${date}｜實到${summary.present} 請假${summary.leave} 無故未到${summary.absent}`;
      const messageHtml = buildEmailHtml(date, submittedAt, records);

      $('submit-rollcall-btn').disabled = true;
      $('submit-rollcall-btn').textContent = '送出中...';

      try {
        const res = await fetch(`https://formsubmit.co/ajax/${CONFIG.EMAIL_TO}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            _subject: subject,
            _template: 'box',
            _captcha: 'false',
            message: messageHtml,
          }),
        });
        const result = await res.json();
        if (result.success !== 'true') {
          throw new Error(result.message || 'Email 送出失敗');
        }

        $('submit-status').classList.remove('hidden');
        $('submit-status').textContent = '✓ 已送達（Email 已寄至 ben83127@gmail.com）';
      } catch (err) {
        alert(err.message || 'Email 送出失敗，若為第一次使用請到信箱點 FormSubmit 啟用連結');
      } finally {
        $('submit-rollcall-btn').disabled = false;
        $('submit-rollcall-btn').textContent = '送出點名表';
      }
    }

    document.addEventListener('click', closeAllMenus);

    $('login-btn').addEventListener('click', tryLogin);
    $('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    $('add-btn').addEventListener('click', () => openForm());
    $('cancel-btn').addEventListener('click', () => $('form-modal').classList.add('hidden'));
    $('submit-rollcall-btn').addEventListener('click', submitRollcall);

    $('player-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const id = $('edit-id').value;

      if (id) {
        const player = roster.find((p) => p.id === Number(id));
        if (player) {
          Object.assign(player, {
            name: data.name.trim(),
            grade: data.grade.trim(),
            parent_name: data.parent_name?.trim() || '',
            parent_phone: data.parent_phone?.trim() || '',
            emergency_phone: data.emergency_phone?.trim() || '',
            notes: data.notes?.trim() || '',
          });
        }
      } else {
        const newPlayer = {
          id: nextPlayerId(),
          name: data.name.trim(),
          grade: data.grade.trim(),
          parent_name: data.parent_name?.trim() || '',
          parent_phone: data.parent_phone?.trim() || '',
          emergency_phone: data.emergency_phone?.trim() || '',
          notes: data.notes?.trim() || '',
          is_active: true,
        };
        roster.push(newPlayer);
        attendance.set(newPlayer.id, '');
        notesMap.set(newPlayer.id, newPlayer.notes);
      }

      saveRosterToStorage();
      $('form-modal').classList.add('hidden');
      renderTable();
    });

    if (adminToken === CONFIG.PASSWORD) showMain();
