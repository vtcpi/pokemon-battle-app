const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Arquivo de dados - AGORA COMPARTILHADO
const DB_FILE = './db.json';

// Inicializa o banco de dados se não existir
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: {
        aizi: {
          name: 'Aizi',
          avatar:
            'https://a0.anyrgb.com/pngimg/1708/588/rattata-raticate-color-depth-pidgeot-8bit-pikachu-bit-sprite-pixel-art-pokemon.png',
          dailyLimit: 120,
          weeklyGoals: ['Meta 1', 'Meta 2', 'Meta 3'],
          points: 0,
          screenTimes: {},
          goalsCompleted: {},
        },
        orfeus: {
          name: 'Orfeus',
          avatar: 'https://art.pixilart.com/sr280fab26ceb71.png',
          dailyLimit: 120,
          weeklyGoals: ['Meta 1', 'Meta 2', 'Meta 3'],
          points: 0,
          screenTimes: {},
          goalsCompleted: {},
        },
      },
      gameSettings: {
        startDate: '2025-08-25',
        endDate: '2025-09-30',
      },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

// Funções auxiliares
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Sistema de bloqueio para evitar conflitos de escrita
let isWriting = false;
const writeQueue = [];

async function safeWriteDB(data) {
  return new Promise((resolve) => {
    writeQueue.push({ data, resolve });
    processWriteQueue();
  });
}

function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;

  isWriting = true;
  const { data, resolve } = writeQueue.shift();

  try {
    writeDB(data);
    resolve(true);
  } catch (error) {
    console.error('Erro ao escrever no banco:', error);
    resolve(false);
  } finally {
    isWriting = false;
    setTimeout(processWriteQueue, 10);
  }
}

function getCurrentWeek() {
  return 1; // Semana fixa conforme solicitado
}

function getWeekDates(weekNumber, year) {
  // Datas fixas para as semanas do período do jogo
  const weekDates = {
    1: [
      // Semana 1: 25/08 a 31/08
      '2025-08-25',
      '2025-08-26',
      '2025-08-27',
      '2025-08-28',
      '2025-08-29',
      '2025-08-30',
      '2025-08-31',
    ],
    2: [
      // Semana 2: 01/09 a 07/09
      '2025-09-01',
      '2025-09-02',
      '2025-09-03',
      '2025-09-04',
      '2025-09-05',
      '2025-09-06',
      '2025-09-07',
    ],
    3: [
      // Semana 3: 08/09 a 14/09
      '2025-09-08',
      '2025-09-09',
      '2025-09-10',
      '2025-09-11',
      '2025-09-12',
      '2025-09-13',
      '2025-09-14',
    ],
    4: [
      // Semana 4: 15/09 a 21/09
      '2025-09-15',
      '2025-09-16',
      '2025-09-17',
      '2025-09-18',
      '2025-09-19',
      '2025-09-20',
      '2025-09-21',
    ],
    5: [
      // Semana 5: 22/09 a 28/09
      '2025-09-22',
      '2025-09-23',
      '2025-09-24',
      '2025-09-25',
      '2025-09-26',
      '2025-09-27',
      '2025-09-28',
    ],
    6: [
      // Semana 6: 29/09 a 30/09 (apenas 2 dias)
      '2025-09-29',
      '2025-09-30',
    ],
  };

  return weekDates[weekNumber] || weekDates[1];
}

function calculatePoints(userId) {
  const data = readDB();
  const user = data.users[userId];
  let points = 0;

  const currentWeek = getCurrentWeek();
  const currentYear = 2025;
  const weekDates = getWeekDates(currentWeek, currentYear);

  // Pontos por não exceder limite diário
  for (const date of weekDates) {
    const screenTime = user.screenTimes[date];
    if (screenTime !== undefined && screenTime <= user.dailyLimit) {
      points += 1;
    }
  }

  // Pontos por objetivos semanais
  const weekKey = `2025-W${currentWeek}`;
  const goalsCompleted = user.goalsCompleted[weekKey] || [];
  points += goalsCompleted.filter((completed) => completed).length;

  return points;
}

function calculateWeeklyWinner() {
  const data = readDB();
  const currentWeek = getCurrentWeek();
  const weekDates = getWeekDates(currentWeek, 2025);

  let aiziTotal = 0;
  let orfeusTotal = 0;

  for (const date of weekDates) {
    aiziTotal += data.users.aizi.screenTimes[date] || 0;
    orfeusTotal += data.users.orfeus.screenTimes[date] || 0;
  }

  if (aiziTotal < orfeusTotal) return 'aizi';
  if (orfeusTotal < aiziTotal) return 'orfeus';
  return 'tie';
}

initDB();

// Rotas da API - AGORA COM SINCRONIZAÇÃO
app.get('/api/users', (req, res) => {
  try {
    const data = readDB();
    // Recalcula pontos antes de enviar
    data.users.aizi.points = calculatePoints('aizi');
    data.users.orfeus.points = calculatePoints('orfeus');

    const weeklyWinner = calculateWeeklyWinner();
    if (weeklyWinner === 'aizi') data.users.aizi.points += 1;
    else if (weeklyWinner === 'orfeus') data.users.orfeus.points += 1;
    else {
      data.users.aizi.points += 1;
      data.users.orfeus.points += 1;
    }

    writeDB(data);
    res.json(data.users);
  } catch (error) {
    console.error('Erro em /api/users:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/user/:userId', (req, res) => {
  try {
    const data = readDB();
    const user = data.users[req.params.userId];
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    user.points = calculatePoints(req.params.userId);
    res.json(user);
  } catch (error) {
    console.error('Erro em /api/user:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/user/:userId', async (req, res) => {
  try {
    const data = readDB();
    const userId = req.params.userId;

    if (!data.users[userId]) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualiza apenas os campos fornecidos
    Object.keys(req.body).forEach((key) => {
      if (key !== 'points') {
        data.users[userId][key] = req.body[key];
      }
    });

    const success = await safeWriteDB(data);
    if (success) {
      res.json(data.users[userId]);
    } else {
      res.status(500).json({ error: 'Erro ao salvar dados' });
    }
  } catch (error) {
    console.error('Erro em PUT /api/user:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/user/:userId/screentime', async (req, res) => {
  try {
    const data = readDB();
    const userId = req.params.userId;
    const { date, minutes } = req.body;

    if (!data.users[userId]) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    data.users[userId].screenTimes[date] = parseInt(minutes);
    const success = await safeWriteDB(data);

    if (success) {
      res.json({ success: true, message: 'Tempo de tela registrado!' });
    } else {
      res.status(500).json({ error: 'Erro ao salvar dados' });
    }
  } catch (error) {
    console.error('Erro em POST /screentime:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/user/:userId/goals', async (req, res) => {
  try {
    const data = readDB();
    const userId = req.params.userId;
    const { week, goals } = req.body;

    if (!data.users[userId]) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!data.users[userId].goalsCompleted) {
      data.users[userId].goalsCompleted = {};
    }

    data.users[userId].goalsCompleted[week] = goals;
    const success = await safeWriteDB(data);

    if (success) {
      res.json({ success: true, message: 'Objetivos atualizados!' });
    } else {
      res.status(500).json({ error: 'Erro ao salvar dados' });
    }
  } catch (error) {
    console.error('Erro em POST /goals:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const data = readDB();
    const currentWeek = getCurrentWeek();
    const weekDates = getWeekDates(currentWeek, 2025);

    const stats = {
      currentWeek,
      weekDates,
      weeklyWinner: calculateWeeklyWinner(),
      aiziPoints: calculatePoints('aizi'),
      orfeusPoints: calculatePoints('orfeus'),
    };

    res.json(stats);
  } catch (error) {
    console.error('Erro em /api/stats:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Serve arquivos estáticos
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(
    `🎮 Acesse http://localhost:${PORT} para começar a batalha Pokémon!`
  );
  console.log(`📊 Sistema de sincronização ativado`);
});
