/**
 * server.js - Backend Express per la gestione di prenotazioni, sondaggi e area riservata (Turso Cloud DB)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@libsql/client');
const config = require('./config');

const app = express();

// Connessione al Database Turso Cloud per il pianista
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://pianista-alessianotaro.aws-eu-west-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE4ODY0OTIsImlkIjoiMDFhMTM0YzEtYWEwMS03NmQzLWFhZjgtNjVlMTJkOWYzMmEzIiwia2lkIjoiN0YyTVItbnlsZ1g0WWRWQmNYQndzSTktczJGcHhma09CQmd2RmNSTjI3ZyIsInJpZCI6IjVjMDQxYjE1LTllMmEtNGE4Yy1hYjU3LWEyODg4YTdhMDc3MyJ9.ffRWNph6_710YfLIWq7v9otItzI8NKxaiDroU5jcUM_XNs5bC8b1MZGL5Qtpl5T_3wsn_Ga6IQifLcwND8iQDw"
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servire i file statici del frontend dalla cartella corrente
app.use(express.static(path.join(__dirname)));

// Inizializzazione Tabelle Turso
async function initDB() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      instrument TEXT NOT NULL,
      duration INTEGER NOT NULL,
      piece TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      puntualita INTEGER,
      preparazione INTEGER,
      flessibilita INTEGER,
      sintonia TEXT,
      supporto TEXT,
      soddisfazione TEXT,
      disponibilita INTEGER,
      raccomandazione TEXT,
      commenti TEXT,
      createdAt TEXT NOT NULL
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS blocked_slots (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      hours INTEGER,
      reason TEXT,
      createdAt TEXT NOT NULL
    )`);

    console.log("[DB Turso - Pianista] Tabelle verificate e pronte!");
  } catch (err) {
    console.error("[DB Turso Error] Errore inizializzazione database:", err);
  }
}
initDB();

// --- API ROTTE PRENOTAZIONI PROVE ---

// GET: Ottieni tutte le prenotazioni
app.get('/api/bookings', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM bookings ORDER BY date, time");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il recupero delle prenotazioni." });
  }
});

// POST: Crea una nuova prenotazione
app.post('/api/bookings', async (req, res) => {
  try {
    const { date, time, name, surname, instrument, duration, piece } = req.body;
    
    if (!date || !time || !name || !surname || !instrument || !duration || !piece) {
      return res.status(400).json({ success: false, message: 'Tutti i campi obbligatori devono essere compilati.' });
    }

    const newBooking = {
      id: 'book_' + Date.now() + Math.random().toString(36).substring(2, 7),
      date,
      time,
      name: name.trim(),
      surname: surname.trim(),
      instrument: instrument.trim(),
      duration: parseInt(duration),
      piece: piece.trim(),
      createdAt: new Date().toISOString()
    };

    await db.execute({
      sql: `INSERT INTO bookings (id, date, time, name, surname, instrument, duration, piece, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [newBooking.id, newBooking.date, newBooking.time, newBooking.name, newBooking.surname, newBooking.instrument, newBooking.duration, newBooking.piece, newBooking.createdAt]
    });

    res.status(201).json({ success: true, message: 'Prenotazione prova registrata con successo', data: newBooking });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il salvataggio della prenotazione." });
  }
});

// DELETE: Elimina una prenotazione specifica (riservato admin)
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: "DELETE FROM bookings WHERE id=?", args: [id] });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'Prenotazione non trovata.' });
    }

    res.json({ success: true, message: 'Prenotazione eliminata con successo.' });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante l'eliminazione della prenotazione." });
  }
});

// DELETE: Elimina tutte le prenotazioni
app.delete('/api/bookings', async (req, res) => {
  try {
    await db.execute("DELETE FROM bookings");
    res.json({ success: true, message: 'Tutte le prenotazioni sono state eliminate.' });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il reset delle prenotazioni." });
  }
});


// --- API ROTTE SONDAGGI ---

// GET: Ottieni risposte sondaggio
app.get('/api/surveys', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM surveys ORDER BY createdAt DESC");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il recupero dei sondaggi." });
  }
});

// POST: Invia sondaggio anonimo dettagliato
app.post('/api/surveys', async (req, res) => {
  try {
    const { puntualita, preparazione, flessibilita, sintonia, supporto, soddisfazione, disponibilita, raccomandazione, commenti } = req.body;

    const newSurvey = {
      id: 'sur_' + Date.now(),
      puntualita: parseInt(puntualita) || 0,
      preparazione: parseInt(preparazione) || 0,
      flessibilita: parseInt(flessibilita) || 0,
      sintonia: sintonia || '',
      supporto: supporto || '',
      soddisfazione: soddisfazione || '',
      disponibilita: parseInt(disponibilita) || 0,
      raccomandazione: raccomandazione || '',
      commenti: commenti ? commenti.trim() : '',
      createdAt: new Date().toISOString()
    };

    await db.execute({
      sql: `INSERT INTO surveys (id, puntualita, preparazione, flessibilita, sintonia, supporto, soddisfazione, disponibilita, raccomandazione, commenti, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newSurvey.id, newSurvey.puntualita, newSurvey.preparazione, newSurvey.flessibilita,
        newSurvey.sintonia, newSurvey.supporto, newSurvey.soddisfazione, newSurvey.disponibilita,
        newSurvey.raccomandazione, newSurvey.commenti, newSurvey.createdAt
      ]
    });

    res.status(201).json({ success: true, message: 'Risposte al sondaggio salvate in forma anonima.', data: newSurvey });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il salvataggio del sondaggio." });
  }
});

// DELETE: Elimina un sondaggio specifico (riservato admin)
app.delete('/api/surveys/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: "DELETE FROM surveys WHERE id=?", args: [id] });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'Sondaggio non trovato.' });
    }

    res.json({ success: true, message: 'Sondaggio eliminato con successo.' });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante l'eliminazione del sondaggio." });
  }
});

// DELETE: Resetta sondaggi
app.delete('/api/surveys', async (req, res) => {
  try {
    await db.execute("DELETE FROM surveys");
    res.json({ success: true, message: 'Sondaggi resettati con successo.' });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il reset dei sondaggi." });
  }
});


// --- API ROTTE GESTIONE BLOCCHI / CHIUSURE (ADMIN) ---

// GET: Ottieni tutti i blocchi attivi
app.get('/api/admin/blocks', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM blocked_slots ORDER BY date, time");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il recupero dei blocchi." });
  }
});

// POST: Aggiungi un blocco (intera giornata o orario specifico)
app.post('/api/admin/blocks', async (req, res) => {
  try {
    const { type, date, time, hours, reason } = req.body;

    if (!type || !date) {
      return res.status(400).json({ success: false, message: 'Tipo e data sono obbligatori.' });
    }

    const newBlock = {
      id: 'block_' + Date.now(),
      type,
      date,
      time: time || null,
      hours: parseInt(hours) || 1,
      reason: reason ? reason.trim() : (type === 'day' ? 'Chiusura straordinaria' : 'Fascia oraria non disponibile'),
      createdAt: new Date().toISOString()
    };

    await db.execute({
      sql: `INSERT INTO blocked_slots (id, type, date, time, hours, reason, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [newBlock.id, newBlock.type, newBlock.date, newBlock.time, newBlock.hours, newBlock.reason, newBlock.createdAt]
    });

    res.status(201).json({ success: true, message: 'Periodo bloccato con successo.', data: newBlock });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante il salvataggio del blocco." });
  }
});

// DELETE: Rimuovi un blocco esistente
app.delete('/api/admin/blocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({ sql: "DELETE FROM blocked_slots WHERE id=?", args: [id] });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'Blocco non trovato.' });
    }

    res.json({ success: true, message: 'Blocco rimosso con successo.' });
  } catch (err) {
    res.status(500).json({ success: false, message: "Errore durante la rimozione del blocco." });
  }
});


// --- API AUTENTICAZIONE ADMIN ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPass = config.ADMIN_PASSWORD || config.adminPassword;
  if (password === adminPass) {
    res.json({ success: true, message: 'Autenticazione riuscita.' });
  } else {
    res.status(401).json({ success: false, message: 'Password non valida.' });
  }
});


// Avvio Server
const PORT = config.PORT || config.port || 10000;
app.listen(PORT, () => {
  console.log(`[SERVER] Maestro Pianista attivo sulla porta ${PORT}`);
  console.log(`[INFO] Apri http://localhost:${PORT} nel browser.`);
});