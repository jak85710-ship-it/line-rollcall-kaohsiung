const express = require('express');
const config = require('../config');
const playerStore = require('../services/players');
const sheets = require('../services/sheets');
const { requireCoachAuth } = require('../middleware/auth');
const { sendRollcallEmail } = require('../services/email');

const router = express.Router();

function todayInTaipei() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

router.get('/config', requireCoachAuth, (req, res) => {
  res.json({
    liffId: config.line.liffId,
    coach: req.lineUser,
    spreadsheetUrl: config.google.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${config.google.spreadsheetId}`
      : null,
  });
});

router.get('/players', requireCoachAuth, async (req, res) => {
  try {
    const sessionDate = req.query.date || todayInTaipei();
    const roster = await playerStore.getActivePlayers();

    let savedRecords = {};
    if (playerStore.useGoogleSheets()) {
      const existingSession = await sheets.getSessionByDateAndCoach(
        sessionDate,
        req.lineUser.userId
      );
      if (existingSession) {
        const sessionData = await sheets.getSessionWithRecords(existingSession.id);
        savedRecords = Object.fromEntries(
          sessionData.records.map((record) => [record.id, record.status])
        );
      }
    }

    res.json({
      date: sessionDate,
      players: roster.map((player) => ({
        ...player,
        status: savedRecords[player.id] || 'pending',
      })),
      hasSubmitted: Boolean(Object.keys(savedRecords).length),
    });
  } catch (error) {
    console.error('[API] Get players failed:', error.message);
    res.status(500).json({ error: '讀取隊員資料失敗' });
  }
});

router.post('/rollcall', requireCoachAuth, async (req, res) => {
  try {
    const sessionDate = req.body.date || todayInTaipei();
    const records = req.body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: '點名資料不可為空' });
    }

    const activePlayers = await playerStore.getActivePlayers();
    const activeIds = new Set(activePlayers.map((p) => p.id));

    for (const record of records) {
      if (!activeIds.has(record.playerId)) {
        return res.status(400).json({ error: `無效的隊員 ID: ${record.playerId}` });
      }
      if (!['pending', 'present', 'absent'].includes(record.status)) {
        return res.status(400).json({ error: '無效的點名狀態' });
      }
    }

    if (!playerStore.useGoogleSheets()) {
      return res.status(503).json({
        error: '點名紀錄需設定 Google Sheets，請先完成 GOOGLE_SPREADSHEET_ID 設定',
      });
    }

    const sessionData = await sheets.saveRollcall({
      sessionDate,
      coachLineUserId: req.lineUser.userId,
      coachName: req.lineUser.name,
      records,
    });

    let emailResult = { sent: false, reason: 'not attempted' };
    try {
      emailResult = await sendRollcallEmail(sessionData);
      if (emailResult.sent) {
        await sheets.markEmailSent(sessionData.session.id);
      }
    } catch (emailError) {
      console.error('[Email] Send failed:', emailError.message);
      emailResult = { sent: false, reason: emailError.message };
    }

    res.json({
      success: true,
      session: sessionData.session,
      summary: {
        present: sessionData.session.present_count,
        absent: sessionData.session.absent_count,
        pending: sessionData.session.leave_count,
        attendanceRate: sessionData.session.attendance_rate,
      },
      email: emailResult,
    });
  } catch (error) {
    console.error('[Rollcall] Submit failed:', error);
    res.status(500).json({ error: '點名儲存失敗，請稍後再試' });
  }
});

router.get('/history/:date', requireCoachAuth, async (req, res) => {
  try {
    if (!playerStore.useGoogleSheets()) {
      return res.status(503).json({ error: '點名紀錄需設定 Google Sheets' });
    }

    const session = await sheets.getSessionByDateAndCoach(
      req.params.date,
      req.lineUser.userId
    );

    if (!session) {
      return res.status(404).json({ error: '找不到該日點名紀錄' });
    }

    res.json(await sheets.getSessionWithRecords(session.id));
  } catch (error) {
    console.error('[API] History failed:', error.message);
    res.status(500).json({ error: '讀取紀錄失敗' });
  }
});

module.exports = router;
