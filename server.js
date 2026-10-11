/**
 * server.js - Backend Express per la gestione di prenotazioni, sondaggi e area riservata
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servire i file statici del frontend dalla cartella corrente
app.use(express.static(path.join(__dirname)));

// In-Memory Database (mock persistente in memoria)
let bookings = [];
let surveys = [];
let blockedSlots = []; // Memoria per giorni o orari bloccati dal Maestro

// --- API ROTTE PRENOTAZIONI PROVE ---

// GET: Ottieni tutte le prenotazioni
app.get('/api/bookings', (req, res) => {
    res.json({ success: true, data: bookings });
});

// POST: Crea una nuova prenotazione con calcolo blocchi orari
app.post('/api/bookings', (req, res) => {
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

    bookings.push(newBooking);
    res.status(201).json({ success: true, message: 'Prenotazione prova registrata con successo', data: newBooking });
});

// DELETE: Elimina una prenotazione specifica (riservato admin)
app.delete('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = bookings.length;
    bookings = bookings.filter(b => b.id !== id);

    if (bookings.length === initialLength) {
        return res.status(404).json({ success: false, message: 'Prenotazione non trovata.' });
    }

    res.json({ success: true, message: 'Prenotazione eliminata con successo.' });
});

// DELETE: Elimina tutte le prenotazioni
app.delete('/api/bookings', (req, res) => {
    bookings = [];
    res.json({ success: true, message: 'Tutte le prenotazioni sono state eliminate.' });
});


// --- API ROTTE SONDAGGI ---

// GET: Ottieni risposte sondaggio
app.get('/api/surveys', (req, res) => {
    res.json({ success: true, data: surveys });
});

// POST: Invia sondaggio anonimo dettagliato
app.post('/api/surveys', (req, res) => {
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

    surveys.push(newSurvey);
    res.status(201).json({ success: true, message: 'Risposte al sondaggio salvate in forma anonima.', data: newSurvey });
});

// DELETE: Elimina un sondaggio specifico (riservato admin)
app.delete('/api/surveys/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = surveys.length;
    surveys = surveys.filter(s => s.id !== id);

    if (surveys.length === initialLength) {
        return res.status(404).json({ success: false, message: 'Sondaggio non trovato.' });
    }

    res.json({ success: true, message: 'Sondaggio eliminato con successo.' });
});

// DELETE: Resetta sondaggi
app.delete('/api/surveys', (req, res) => {
    surveys = [];
    res.json({ success: true, message: 'Sondaggi resettati con successo.' });
});


// --- API ROTTE GESTIONE BLOCCHI / CHIUSURE (ADMIN) ---

// GET: Ottieni tutti i blocchi attivi
app.get('/api/admin/blocks', (req, res) => {
    res.json({ success: true, data: blockedSlots });
});

// POST: Aggiungi un blocco (intera giornata o orario specifico)
app.post('/api/admin/blocks', (req, res) => {
    const { type, date, time, hours, reason } = req.body; // type: 'day' oppure 'slot'

    if (!type || !date) {
        return res.status(400).json({ success: false, message: 'Tipo e data sono obbligatori.' });
    }

    const newBlock = {
        id: 'block_' + Date.now(),
        type,
        date,
        time: time || null,
        hours: parseInt(hours) || 1, // Gestione ore multiple (default 1)
        reason: reason ? reason.trim() : (type === 'day' ? 'Chiusura straordinaria' : 'Fascia oraria non disponibile'), // Gestione motivazione personalizzata
        createdAt: new Date().toISOString()
    };

    blockedSlots.push(newBlock);
    res.status(201).json({ success: true, message: 'Periodo bloccato con successo.', data: newBlock });
});

// DELETE: Rimuovi un blocco esistente
app.delete('/api/admin/blocks/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = blockedSlots.length;
    blockedSlots = blockedSlots.filter(b => b.id !== id);

    if (blockedSlots.length === initialLength) {
        return res.status(404).json({ success: false, message: 'Blocco non trovato.' });
    }

    res.json({ success: true, message: 'Blocco rimosso con successo.' });
});


// --- API AUTENTICAZIONE ADMIN ---
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === config.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Autenticazione riuscita.' });
    } else {
        res.status(401).json({ success: false, message: 'Password non valida.' });
    }
});


// Avvio Server
app.listen(config.PORT, () => {
    console.log(`[SERVER] Maestro Pianista attivo sulla porta ${config.PORT}`);
    console.log(`[INFO] Apri http://localhost:${config.PORT} nel browser.`);
});