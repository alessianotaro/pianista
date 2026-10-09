document.addEventListener('DOMContentLoaded', () => {
    // Menu mobile toggle
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Gestione Prenotazioni Prove & Blocchi
    const dateInput = document.getElementById('booking-date');
    const slotsContainer = document.getElementById('time-slots-container');
    const slotsGrid = document.getElementById('slots-grid');
    const bookingForm = document.getElementById('booking-form');
    const durationSelect = document.getElementById('b-duration');

    let selectedDate = '';
    let selectedTime = '';
    let existingBookings = [];
    let blockedSlotsList = [];

    // Imposta data minima a oggi
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.min = todayStr;
    dateInput.value = todayStr;

    async function fetchData() {
        try {
            const [resB, resBl] = await Promise.all([
                fetch('/api/bookings'),
                fetch('/api/admin/blocks')
            ]);
            const jsonB = await resB.json();
            const jsonBl = await resBl.json();
            if (jsonB.success) existingBookings = jsonB.data;
            if (jsonBl.success) blockedSlotsList = jsonBl.data;
        } catch (e) {
            console.error('Errore caricamento dati:', e);
        }
    }

    // Orari base disponibili giornalieri
    const baseSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    async function renderSlots() {
        await fetchData();
        selectedDate = dateInput.value;
        slotsContainer.classList.remove('hidden');
        slotsGrid.innerHTML = '';
        bookingForm.classList.add('hidden');
        selectedTime = '';

        // Controlla se l'intera giornata è bloccata dal Maestro
        const isDayBlocked = blockedSlotsList.some(b => b.date === selectedDate && b.type === 'day');

        // Filtra prenotazioni e blocchi orari per la data scelta
        const dateBookings = existingBookings.filter(b => b.date === selectedDate);
        const dateBlocks = blockedSlotsList.filter(b => b.date === selectedDate && b.type === 'slot');

        baseSlots.forEach(slot => {
            let isOccupied = isDayBlocked;

            // Controlla se lo slot specifico è bloccato dal Maestro
            if (!isOccupied && dateBlocks.some(b => b.time === slot)) {
                isOccupied = true;
            }

            // Controlla se lo slot è occupato da prenotazioni esistenti
            if (!isOccupied) {
                dateBookings.forEach(b => {
                    const bTimeMinutes = timeToMinutes(b.time);
                    const slotMinutes = timeToMinutes(slot);
                    const bEndMinutes = bTimeMinutes + b.duration;
                    if (slotMinutes >= bTimeMinutes && slotMinutes < bEndMinutes) {
                        isOccupied = true;
                    }
                });
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = slot;
            btn.className = `py-2.5 rounded-lg border text-sm font-medium transition ${
                isOccupied 
                    ? 'bg-stone-950 border-stone-800 text-stone-600 cursor-not-allowed line-through' 
                    : 'bg-stone-950 gold-border text-stone-300 hover:border-amber-400 hover:text-amber-400'
            }`;

            if (!isOccupied) {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#slots-grid button').forEach(b => b.classList.remove('bg-amber-600', 'text-stone-950', 'font-bold'));
                    btn.classList.add('bg-amber-600', 'text-stone-950', 'font-bold');
                    selectedTime = slot;
                    bookingForm.classList.remove('hidden');
                    bookingForm.scrollIntoView({ behavior: 'smooth' });
                });
            }

            slotsGrid.appendChild(btn);
        });
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    if (dateInput) {
        dateInput.addEventListener('change', renderSlots);
        renderSlots();
    }

    // Invio form prenotazione
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                date: selectedDate,
                time: selectedTime,
                name: document.getElementById('b-name').value,
                surname: document.getElementById('b-surname').value,
                instrument: document.getElementById('b-instrument').value,
                duration: parseInt(durationSelect.value),
                piece: document.getElementById('b-piece').value
            };

            try {
                const res = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.success) {
                    alert('Prenotazione effettuata con successo!');
                    bookingForm.reset();
                    bookingForm.classList.add('hidden');
                    renderSlots();
                } else {
                    alert('Errore: ' + json.message);
                }
            } catch (err) {
                alert('Errore di connessione al server.');
            }
        });
    }

    // Sondaggio Anonimo Dettagliato
    const surveyForm = document.getElementById('survey-form');
    if (surveyForm) {
        surveyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                puntualita: document.querySelector('input[name="q_puntualita"]:checked')?.value,
                preparazione: document.querySelector('input[name="q_preparazione"]:checked')?.value,
                flessibilita: document.querySelector('input[name="q_flessibilita"]:checked')?.value,
                sintonia: document.getElementById('s-sintonia').value,
                supporto: document.getElementById('s-supporto').value,
                soddisfazione: document.getElementById('s-soddisfazione').value,
                disponibilita: document.querySelector('input[name="q_disponibilita"]:checked')?.value,
                raccomandazione: document.getElementById('s-raccomandazione').value,
                commenti: document.getElementById('s-commenti').value
            };

            try {
                const res = await fetch('/api/surveys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.success) {
                    alert('Grazie! Risposta al sondaggio inviata in forma anonima.');
                    surveyForm.reset();
                } else {
                    alert('Errore: ' + json.message);
                }
            } catch (err) {
                alert('Errore di connessione al server.');
            }
        });
    }

    // Area Riservata Admin
    const loginForm = document.getElementById('login-form');
    const loginBox = document.getElementById('admin-login-box');
    const dashboard = document.getElementById('admin-dashboard');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password').value;

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const json = await res.json();
                if (json.success) {
                    loginBox.classList.add('hidden');
                    dashboard.classList.remove('hidden');
                    loadAdminData();
                } else {
                    alert('Password errata!');
                }
            } catch (e) {
                alert('Errore di connessione.');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            dashboard.classList.add('hidden');
            loginBox.classList.remove('hidden');
            document.getElementById('admin-password').value = '';
        });
    }

    // Gestione visibilità selettore orario nel form blocchi admin
    const blockTypeSelect = document.getElementById('block-type');
    const blockTimeWrapper = document.getElementById('block-time-wrapper');
    if (blockTypeSelect) {
        blockTypeSelect.addEventListener('change', () => {
            if (blockTypeSelect.value === 'day') {
                blockTimeWrapper.classList.add('hidden');
            } else {
                blockTimeWrapper.classList.remove('hidden');
            }
        });
    }

    // Invio form blocco admin
    const blockForm = document.getElementById('block-form');
    if (blockForm) {
        blockForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                type: document.getElementById('block-type').value,
                date: document.getElementById('block-date').value,
                time: document.getElementById('block-type').value === 'slot' ? document.getElementById('block-time').value : null
            };

            try {
                const res = await fetch('/api/admin/blocks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.success) {
                    alert('Periodo bloccato con successo.');
                    blockForm.reset();
                    if (blockTimeWrapper) blockTimeWrapper.classList.remove('hidden');
                    loadAdminData();
                    renderSlots();
                } else {
                    alert('Errore: ' + json.message);
                }
            } catch (err) {
                alert('Errore di connessione.');
            }
        });
    }

    // Funzione globale per eliminare un blocco
    window.deleteBlock = async function(id) {
        if (!confirm('Vuoi rimuovere questo blocco e rendere nuovamente disponibile l\'orario?')) return;
        try {
            const res = await fetch(`/api/admin/blocks/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                loadAdminData();
                renderSlots();
            } else {
                alert('Errore durante l\'eliminazione.');
            }
        } catch (e) {
            alert('Errore di connessione.');
        }
    };

    async function loadAdminData() {
        await fetchData();

        // Carica prenotazioni
        const tbodyB = document.getElementById('admin-bookings-table');
        tbodyB.innerHTML = '';
        if (existingBookings.length > 0) {
            existingBookings.forEach(b => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-stone-800 hover:bg-stone-950/40';
                tr.innerHTML = `
                    <td class="p-3">${b.date}</td>
                    <td class="p-3 font-semibold text-amber-400">${b.time}</td>
                    <td class="p-3">${b.name} ${b.surname}</td>
                    <td class="p-3">${b.instrument}</td>
                    <td class="p-3">${b.duration} min</td>
                    <td class="p-3 italic">${b.piece}</td>
                `;
                tbodyB.appendChild(tr);
            });
        } else {
            tbodyB.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-stone-500">Nessuna prenotazione attiva.</td></tr>`;
        }

        // Carica sondaggi dettagliati
        try {
            const resS = await fetch('/api/surveys');
            const jsonS = await resS.json();
            const tbodyS = document.getElementById('admin-surveys-table');
            tbodyS.innerHTML = '';
            if (jsonS.success && jsonS.data.length > 0) {
                jsonS.data.forEach(s => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-stone-800 hover:bg-stone-950/40';
                    tr.innerHTML = `
                        <td class="p-3 text-xs">${new Date(s.createdAt).toLocaleDateString()}</td>
                        <td class="p-3">Punt: ${s.puntualita}/5<br>Prep: ${s.preparazione}/5<br>Fless: ${s.flessibilita}/5</td>
                        <td class="p-3">Sintonia: ${s.sintonia}<br>Supporto: ${s.supporto}</td>
                        <td class="p-3">Soddisfazione: ${s.soddisfazione}<br>Disp: ${s.disponibilita}/5<br>Consiglierebbe: ${s.raccomandazione}</td>
                        <td class="p-3 italic text-stone-400 max-w-xs">${s.commenti || 'Nessun commento'}</td>
                    `;
                    tbodyS.appendChild(tr);
                });
            } else {
                tbodyS.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-stone-500">Nessuna risposta al sondaggio registrata.</td></tr>`;
            }
        } catch (e) {
            console.error(e);
        }

        // Carica blocchi attivi nella tabella admin
        const tbodyBl = document.getElementById('admin-blocks-table');
        if (tbodyBl) {
            tbodyBl.innerHTML = '';
            if (blockedSlotsList.length > 0) {
                blockedSlotsList.forEach(b => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-stone-800 hover:bg-stone-950/40';
                    tr.innerHTML = `
                        <td class="p-2.5 font-semibold text-amber-400">${b.type === 'day' ? 'Intera Giornata' : 'Orario Specifico'}</td>
                        <td class="p-2.5">${b.date}</td>
                        <td class="p-2.5">${b.time || '-'}</td>
                        <td class="p-2.5 text-right">
                            <button onclick="deleteBlock('${b.id}')" class="px-3 py-1 bg-red-900/40 border border-red-700 text-red-300 rounded text-xs hover:bg-red-900">Rimuovi</button>
                        </td>
                    `;
                    tbodyBl.appendChild(tr);
                });
            } else {
                tbodyBl.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-stone-500">Nessun blocco attivo.</td></tr>`;
            }
        }
    }
});
