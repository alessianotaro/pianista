document.addEventListener('DOMContentLoaded', () => {
    // 1. Menu mobile toggle e chiusura automatica con scroll fluido
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    mobileMenu.classList.add('hidden');
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }

    // 2. Curriculum "Leggi tutto" dinamico per mobile
    const curriculumContainer = document.getElementById('curriculum-container');
    const toggleCurriculumBtn = document.getElementById('toggle-curriculum-btn');
    const curriculumFade = document.getElementById('curriculum-fade');
    const curriculumArrow = document.getElementById('curriculum-arrow');
    const toggleText = document.getElementById('toggle-text');

    if (toggleCurriculumBtn && curriculumContainer) {
        let isExpanded = false;
        toggleCurriculumBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                curriculumContainer.style.maxHeight = curriculumContainer.scrollHeight + 'px';
                if (curriculumFade) curriculumFade.style.display = 'none';
                if (toggleText) toggleText.textContent = 'Riduci';
                if (curriculumArrow) curriculumArrow.style.transform = 'rotate(180deg)';
            } else {
                curriculumContainer.style.maxHeight = '200px';
                if (curriculumFade) curriculumFade.style.display = 'block';
                if (toggleText) toggleText.textContent = 'Leggi tutto';
                if (curriculumArrow) curriculumArrow.style.transform = 'rotate(0deg)';
            }
        });
    }

    // 3. Gestione Calendario Prenotazioni Integrato & Blocchi
    const appContainer = document.getElementById('booking-app');
    let mon = new Date(), sel = null, start = null, durationMinutes = 60, existingBookings = [], blockedSlotsList = [], err = "", done = null;
    mon.setDate(1);

    const pad = n => String(n).padStart(2, "0");
    const hm = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
    const ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const it = d => new Date(d + "T12:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

    function formatDurationLabel(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} ${h === 1 ? 'ora' : 'ore'}`;
        return `${h}h ${m}m (${mins} min)`;
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function free(t, dur) {
        const isDayBlocked = blockedSlotsList.some(b => b.date === sel && b.type === 'day');
        if (isDayBlocked) return false;

        const dateBlocks = blockedSlotsList.filter(b => b.date === sel && b.type === 'slot');
        const slotTimeStr = hm(t);
        if (dateBlocks.some(b => b.time === slotTimeStr)) return false;

        // Pausa Pranzo (14:00 - 14:30)
        const breakStart = 14 * 60; 
        const breakEnd = 14 * 60 + 30; 
        if (t < breakEnd && t + dur > breakStart) {
            return false;
        }

        return !existingBookings.some(b => {
            if (b.date !== sel) return false;
            const bTimeMinutes = timeToMinutes(b.time);
            return bTimeMinutes < t + dur && bTimeMinutes + b.duration > t;
        });
    }

    function getAvailableSlots() {
        const now = new Date(), today = ds(now) === sel;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const r = [];

        const morningStart = 9 * 60;
        const morningLimit = 14 * 60; // Fine mattina ore 14:00

        const afternoonStart = 14 * 60 + 30;
        const afternoonLimit = 16 * 60 + 30; // Fine pomeriggio ore 16:30

        // Slot mattina (ogni 30 minuti)
        for (let t = morningStart; t + durationMinutes <= morningLimit; t += 30) {
            const past = today && t <= currentMinutes;
            if (!past && free(t, durationMinutes)) {
                r.push([t, true]);
            } else {
                r.push([t, false]);
            }
        }

        // Slot pomeriggio (ogni 30 minuti)
        for (let t = afternoonStart; t + durationMinutes <= afternoonLimit; t += 30) {
            const past = today && t <= currentMinutes;
            if (!past && free(t, durationMinutes)) {
                r.push([t, true]);
            } else {
                r.push([t, false]);
            }
        }

        return r;
    }

    async function loadBookingData() {
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
            console.error('Errore caricamento dati calendario:', e);
        }
    }

    async function renderCalendarWidget() {
        if (!appContainer) return;

        if (done) {
            appContainer.innerHTML = `
                <div class="text-center py-8 space-y-4">
                    <h3 class="text-2xl font-serif text-amber-400">Prenotazione confermata ✨</h3>
                    <p class="text-stone-300"><b>${done.name} ${done.surname}</b>, ti aspettiamo per la prova.</p>
                    <p class="text-sm text-stone-400">${it(done.date)}<br>ore ${hm(done.start)} · ${formatDurationLabel(done.duration)} (${done.instrument})</p>
                    <button type="button" onclick="window.resetBooking()" class="px-6 py-2.5 bg-amber-600 text-stone-950 font-semibold rounded-lg hover:bg-amber-500">Nuova prenotazione</button>
                </div>`;
            return;
        }

        const y = mon.getFullYear(), mo = mon.getMonth(), first = (new Date(y, mo, 1).getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate(), td = ds(new Date());
        let cal = `<div class="grid grid-cols-7 gap-2 text-center text-xs text-stone-400 mb-2">`;
        ["L", "M", "M", "G", "V", "S", "D"].forEach(x => cal += `<span>${x}</span>`);
        cal += `</div><div class="grid grid-cols-7 gap-2 text-center">`;

        for (let i = 0; i < first; i++) cal += `<span></span>`;
        for (let d = 1; d <= dim; d++) {
            const k = y + "-" + pad(mo + 1) + "-" + pad(d);
            const isDisabled = k < td;
            const isSelected = k === sel;
            cal += `<button type="button" class="py-2 rounded-lg text-sm transition ${isSelected ? 'bg-amber-600 text-stone-950 font-bold' : 'bg-stone-950 hover:border-amber-400 border border-stone-800'} ${isDisabled ? 'opacity-30 cursor-not-allowed line-through' : ''}" ${isDisabled ? "disabled" : ""} onclick="window.pickDate('${k}')">${d}</button>`;
        }
        cal += `</div>`;

        let h = `
            <div class="flex justify-between items-center mb-4">
                <button type="button" onclick="window.moveMonth(-1)" class="px-3 py-1 bg-stone-950 border border-stone-800 rounded hover:border-amber-400">‹</button>
                <b class="font-serif capitalize text-amber-400">${mon.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</b>
                <button type="button" onclick="window.moveMonth(1)" class="px-3 py-1 bg-stone-950 border border-stone-800 rounded hover:border-amber-400">›</button>
            </div>
            ${cal}`;

        if (sel) {
            h += `<div class="mt-6 pt-6 border-t border-stone-800 space-y-4">
                <p class="text-sm font-semibold text-amber-400">Data selezionata: ${it(sel)}</p>
                
                <!-- Selettore Durata con Pulsanti e Frecce -->
                <div class="bg-stone-950/40 p-4 rounded-xl border border-stone-800 space-y-2">
                    <div class="flex justify-between items-center">
                        <label class="block text-xs text-stone-400">Durata della Prova</label>
                        <span id="duration-label" class="text-xs font-semibold text-amber-400">${formatDurationLabel(durationMinutes)}</span>
                    </div>
                    
                    <div class="flex items-center justify-between gap-2">
                        <button type="button" onclick="window.adjustDuration(-5)" class="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 rounded-lg text-sm font-bold transition">-5m</button>
                        <button type="button" onclick="window.adjustDuration(-1)" class="px-2 py-1.5 bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 rounded-lg text-xs transition">◀ -1m</button>
                        
                        <div class="text-center font-mono text-amber-400 font-bold text-sm sm:text-base" id="duration-display">${durationMinutes} min</div>
                        
                        <button type="button" onclick="window.adjustDuration(1)" class="px-2 py-1.5 bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 rounded-lg text-xs transition">+1m ▶</button>
                        <button type="button" onclick="window.adjustDuration(5)" class="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 rounded-lg text-sm font-bold transition">+5m</button>
                    </div>
                    <div class="flex justify-between text-[10px] text-stone-500 pt-1">
                        <span>Min: 60 min (1h)</span>
                        <span>Max: 120 min (2h)</span>
                    </div>
                </div>

                <div>
                    <label class="block text-xs text-stone-400 mb-2">Orari Disponibili</label>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">`;
            
            let anyAvailable = false;
            getAvailableSlots().forEach(([t, ok]) => {
                if (ok) anyAvailable = true;
                const isSelectedTime = start === t;
                h += `<button type="button" class="py-2 rounded-lg text-xs font-medium border transition ${isSelectedTime ? 'bg-amber-600 text-stone-950 font-bold' : ok ? 'bg-stone-950 border-stone-800 hover:border-amber-400 text-stone-300' : 'bg-stone-950 border-stone-900 text-stone-700 line-through cursor-not-allowed'}" ${ok ? '' : 'disabled'} onclick="window.pickTime(${t})">${hm(t)}</button>`;
            });
            h += `</div>`;
            if (!anyAvailable) h += `<p class="text-xs text-stone-500 mt-2">Nessun orario disponibile per questa durata in questo giorno.</p>`;
            h += `</div>`;

            if (start !== null) {
                h += `
                    <div class="space-y-3 pt-4 border-t border-stone-800">
                        <p class="text-xs font-semibold text-amber-400">Inserisci i tuoi dati</p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input id="w-name" placeholder="Nome *" class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200">
                            <input id="w-surname" placeholder="Cognome *" class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input id="w-instrument" placeholder="Strumento / Voce *" class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200">
                            <input id="w-piece" placeholder="Brano in prova *" class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200">
                        </div>
                        <p class="text-red-400 text-xs">${err}</p>
                        <button type="button" id="w-go" onclick="window.submitWidgetBooking()" class="w-full py-3 bg-amber-600 text-stone-950 font-semibold rounded-lg hover:bg-amber-500 text-sm">Conferma Prenotazione (${hm(start)} - ${hm(start + durationMinutes)})</button>
                    </div>`;
            }
            h += `</div>`;
        }

        appContainer.innerHTML = h;
    }

    // Funzioni globali per il widget interattivo
    window.moveMonth = async function(n) {
        mon.setMonth(mon.getMonth() + n);
        await renderCalendarWidget();
    };

    window.pickDate = async function(k) {
        sel = k;
        start = null;
        err = "";
        await loadBookingData();
        await renderCalendarWidget();
    };

    window.adjustDuration = function(delta) {
        let newDur = durationMinutes + delta;
        if (newDur < 60) newDur = 60;   // Minimo 1 ora
        if (newDur > 120) newDur = 120; // Massimo 2 ore
        
        durationMinutes = newDur;
        start = null;
        renderCalendarWidget();
    };

    window.pickTime = function(t) {
        start = t;
        err = "";
        renderCalendarWidget();
    };

    window.resetBooking = async function() {
        done = null;
        start = null;
        sel = null;
        err = "";
        await loadBookingData();
        await renderCalendarWidget();
    };

    window.submitWidgetBooking = async function() {
        const name = document.getElementById("w-name")?.value.trim();
        const surname = document.getElementById("w-surname")?.value.trim();
        const instrument = document.getElementById("w-instrument")?.value.trim();
        const piece = document.getElementById("w-piece")?.value.trim();

        if (!name || !surname || !instrument || !piece) {
            err = "Tutti i campi sono obbligatori.";
            renderCalendarWidget();
            return;
        }

        const btnGo = document.getElementById("w-go");
        if (btnGo) btnGo.disabled = true;

        const payload = {
            date: sel,
            time: hm(start),
            name,
            surname,
            instrument,
            duration: durationMinutes,
            piece
        };

        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const j = await res.json();
            if (res.ok) {
                done = { name, surname, date: sel, start, duration: durationMinutes, instrument };
                err = "";
            } else {
                err = j.message || "Errore durante la prenotazione.";
                if (res.status === 409) start = null;
            }
        } catch (e) {
            err = "Errore di connessione al server.";
        }
        await loadBookingData();
        renderCalendarWidget();
    };

    // 4. Sondaggio Anonimo Dettagliato
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

    // 5. Area Riservata Admin
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
                time: document.getElementById('block-type').value === 'slot' ? document.getElementById('block-time').value : null,
                reason: document.getElementById('block-reason')?.value.trim() || 'Chiuso'
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
                    renderCalendarWidget();
                } else {
                    alert('Errore: ' + json.message);
                }
            } catch (err) {
                alert('Errore di connessione.');
            }
        });
    }

    // Funzioni globali per eliminare blocchi, prenotazioni e sondaggi
    window.deleteBlock = async function(id) {
        if (!confirm('Vuoi rimuovere questo blocco e rendere nuovamente disponibile l\'orario?')) return;
        try {
            const res = await fetch(`/api/admin/blocks/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                loadAdminData();
                renderCalendarWidget();
            } else {
                alert('Errore durante l\'eliminazione.');
            }
        } catch (e) {
            alert('Errore di connessione.');
        }
    };

    window.deleteBooking = async function(id) {
        if (!confirm('Vuoi eliminare questa prenotazione?')) return;
        try {
            const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                loadAdminData();
                renderCalendarWidget();
            } else {
                alert('Errore durante l\'eliminazione della prenotazione.');
            }
        } catch (e) {
            alert('Errore di connessione.');
        }
    };

    window.deleteSurvey = async function(id) {
        if (!confirm('Vuoi eliminare questa risposta al sondaggio?')) return;
        try {
            const res = await fetch(`/api/surveys/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                loadAdminData();
            } else {
                alert('Errore durante l\'eliminazione del sondaggio.');
            }
        } catch (e) {
            alert('Errore di connessione.');
        }
    };

    async function loadAdminData() {
        await loadBookingData();

        const tbodyB = document.getElementById('admin-bookings-table');
        if (tbodyB) {
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
                        <td class="p-3 text-right">
                            <button onclick="deleteBooking('${b.id}')" class="px-3 py-1 bg-red-900/40 border border-red-700 text-red-300 rounded text-xs hover:bg-red-900">Elimina</button>
                        </td>
                    `;
                    tbodyB.appendChild(tr);
                });
            } else {
                tbodyB.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-stone-500">Nessuna prenotazione attiva.</td></tr>`;
            }
        }

        try {
            const resS = await fetch('/api/surveys');
            const jsonS = await resS.json();
            const tbodyS = document.getElementById('admin-surveys-table');
            if (tbodyS) {
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
                            <td class="p-3 text-right">
                                <button onclick="deleteSurvey('${s.id}')" class="px-3 py-1 bg-red-900/40 border border-red-700 text-red-300 rounded text-xs hover:bg-red-900">Elimina</button>
                            </td>
                        `;
                        tbodyS.appendChild(tr);
                    });
                } else {
                    tbodyS.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-stone-500">Nessuna risposta al sondaggio registrata.</td></tr>`;
                }
            }
        } catch (e) {
            console.error(e);
        }

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
                        <td class="p-2.5 italic text-stone-400">${b.reason || 'Chiuso'}</td>
                        <td class="p-2.5 text-right">
                            <button onclick="deleteBlock('${b.id}')" class="px-3 py-1 bg-red-900/40 border border-red-700 text-red-300 rounded text-xs hover:bg-red-900">Rimuovi</button>
                        </td>
                    `;
                    tbodyBl.appendChild(tr);
                });
            } else {
                tbodyBl.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-stone-500">Nessun blocco attivo.</td></tr>`;
            }
        }
    }

    loadBookingData().then(() => renderCalendarWidget());
});