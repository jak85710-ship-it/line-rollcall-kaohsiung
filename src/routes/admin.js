const express = require('express');
const players = require('../services/players');
const rollcallLocal = require('../services/rollcall-local');
const { sendAdminRollcallEmail, sendRollcallRangeSummaryEmail } = require('../services/email');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();
const VALID_STATUSES = ['present', 'late', 'competition', 'leave', 'absent'];

function todayInTaipei() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function toDateString(input, fallback) {
  if (!input) return fallback;
  const raw = String(input).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  return raw;
}

router.use(requireAdminAuth);

router.get('/players', async (req, res) => {
  try {
    const playersList = (await players.getAllPlayers()).filter((p) => p.is_active && p.name);
    res.json({ players: playersList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/players', async (req, res) => {
  const required = ['name', 'grade'];
  for (const field of required) {
    if (!req.body[field]?.trim()) {
      return res.status(400).json({ error: `缺少必填欄位：${field}` });
    }
  }

  try {
    const player = await players.createPlayer({
      name: req.body.name.trim(),
      grade: req.body.grade.trim(),
      parent_name: req.body.parent_name?.trim() || '',
      parent_phone: req.body.parent_phone?.trim() || '',
      emergency_phone: req.body.emergency_phone?.trim() || '',
      notes: req.body.notes?.trim() || '',
    });
    res.status(201).json({ player });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/players/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const player = await players.updatePlayer(id, {
      name: req.body.name?.trim(),
      grade: req.body.grade?.trim(),
      parent_name: req.body.parent_name?.trim(),
      parent_phone: req.body.parent_phone?.trim(),
      emergency_phone: req.body.emergency_phone?.trim(),
      notes: req.body.notes?.trim(),
    });

    if (!player) {
      return res.status(404).json({ error: '找不到該隊員' });
    }

    res.json({ player });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/players/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await players.deletePlayer(id);
    if (!deleted) {
      return res.status(404).json({ error: '找不到該隊員' });
    }
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/rollcall/summary-email', async (req, res) => {
  try {
    const endDate = toDateString(req.body.endDate, todayInTaipei());
    const startDate = toDateString(req.body.startDate, '2026-07-10');

    if (startDate > endDate) {
      return res.status(400).json({ error: '起始日期不可晚於結束日期' });
    }

    const sessions = rollcallLocal
      .loadSessions()
      .filter((s) => s.sessionDate && s.sessionDate >= startDate && s.sessionDate <= endDate)
      .sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)));

    if (sessions.length === 0) {
      return res.status(404).json({ error: `找不到 ${startDate} ~ ${endDate} 的點名資料` });
    }

    const email = await sendRollcallRangeSummaryEmail({ startDate, endDate, sessions });
    res.json({
      success: true,
      message: `已整理 ${sessions.length} 筆點名並寄出彙整`,
      startDate,
      endDate,
      sessions: sessions.length,
      email,
    });
  } catch (error) {
    console.error('[Rollcall Summary Email]', error);
    res.status(500).json({ error: '彙整寄送失敗' });
  }
});

router.post('/rollcall', async (req, res) => {
  try {
    const sessionDate = req.body.date || todayInTaipei();
    const fullRecords = req.body.fullRecords;
    const records = req.body.records;

    const detailRecords = [];
    const summary = { present: 0, late: 0, competition: 0, leave: 0, absent: 0 };

    if (Array.isArray(fullRecords) && fullRecords.length > 0) {
      for (const record of fullRecords) {
        if (!VALID_STATUSES.includes(record.status)) {
          return res.status(400).json({ error: '無效的出席狀態' });
        }
        summary[record.status] += 1;
        detailRecords.push({
          playerId: record.playerId || record.id,
          name: record.name,
          grade: record.grade || '',
          parent_phone: record.parent_phone || '',
          notes: record.notes || '',
          status: record.status,
          statusLabel: rollcallLocal.STATUS_LABELS[record.status],
        });
      }
    } else {
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: '點名資料不可為空' });
      }

      const roster = await players.getActivePlayers();
      const rosterMap = Object.fromEntries(roster.map((p) => [p.id, p]));

      for (const record of records) {
        if (!record.status || !VALID_STATUSES.includes(record.status)) {
          continue;
        }
        const player = rosterMap[record.playerId];
        if (!player) {
          return res.status(400).json({ error: `無效的隊員 ID: ${record.playerId}` });
        }
        summary[record.status] += 1;
        detailRecords.push({
          playerId: player.id,
          name: player.name,
          grade: player.grade,
          parent_phone: player.parent_phone,
          notes: record.notes ?? player.notes ?? '',
          status: record.status,
          statusLabel: rollcallLocal.STATUS_LABELS[record.status],
        });
      }
    }

    if (detailRecords.length === 0) {
      return res.status(400).json({ error: '點名資料不可為空' });
    }

    const submittedAt = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    rollcallLocal.saveSession({
      sessionDate,
      submittedAt,
      records: detailRecords,
      summary,
    });

    const emailPayload = {
      sessionDate,
      submittedAt,
      records: detailRecords,
      summary,
    };

    const emailResult = await sendAdminRollcallEmail(emailPayload);

    res.json({
      success: true,
      message: '已送達',
      sessionDate,
      submittedAt,
      summary,
      email: emailResult,
    });
  } catch (error) {
    console.error('[Admin Rollcall]', error);
    res.status(500).json({ error: '點名表送出失敗' });
  }
});

module.exports = router;
