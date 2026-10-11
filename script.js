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

    // 2. Curriculum "Leggi tutto" dinamico solo per mobile
    const curriculumContainer = document.getElementById('curriculum-container');
    const toggleCurriculumBtn = document.getElementById('toggle-curriculum-btn');
    const curriculumFade = document.getElementById('curriculum-fade');
    const curriculumArrow = document.getElementById('curriculum-arrow');
    const toggleText = document.getElementById('toggle-text');

    if (toggleCurriculumBtn && curriculumContainer) {
        let isExpanded = false;

        function checkScreenSize() {
            if (window.innerWidth >= 640) {
                curriculumContainer.style.maxHeight = 'none';
            } else {
                if (!isExpanded) {
                    curriculumContainer.style.maxHeight = '200px';
                }
            }
        }

        window.addEventListener('resize', checkScreenSize);
        checkScreenSize();

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
                curriculumContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function isWeekend(dateStr) {
        const d = new Date(dateStr + "T12:00");
        const day = d.getDay();
        return day === 0 || day === 6;
    }

    function free(t, dur) {
        if (isWeekend(sel)) return false;

        // Controllo se l'intera giornata è bloccata
        const isDayBlocked = blockedSlotsList.some(b => b.date === sel && b.type === 'day');
        if (isDayBlocked) return false;

        // Controllo blocchi a fascia oraria
        const dateBlocks = blockedSlotsList.filter(b => b.date === sel && b.type === 'slot');
        for (let block of dateBlocks) {
            const blockStartMinutes = timeToMinutes(block.time);
            // Assicuriamoci che block.hours sia convertito in numero (default 1)
            const blockHours = parseInt(block.hours) || 1;
            const blockEndMinutes = blockStartMinutes + (blockHours * 60);

            // Se l'orario della prova si sovrappone al blocco, restituisce false
            if (t < blockEndMinutes && t + dur > blockStartMinutes) {
                return false;
            }
        }

        // Controllo pausa pranzo (14:00 - 14:30)
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
        if (isWeekend(sel)) return [];

        const now = new Date(), today = ds(now) === sel;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const r = [];

        // Orari fissi richiesti
        const allowedSlots = [
            "09:00", "10:00", "11:00", "12:00", "13:00", 
            "14:30", "15:30", "16:30"
        ];

        allowedSlots.forEach(slotStr => {
            const t = timeToMinutes(slotStr);
            const past = today && t <= currentMinutes;
            if (!past && free(t, 60)) {
                r.push([t, true]);
            } else {
                r.push([t, false]);
            }
        });

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
                    <p class="text-sm text-stone-400">${it(done.date)}<br>ore ${hm(done.start)} · 1 ora (${done.instrument})</p>
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
            const isWeekendDay = isWeekend(k);
            const isDisabled = k < td || isWeekendDay;
            const isSelected = k === sel;
            
            cal += `<button type="button" class="py-2 rounded-lg text-sm transition ${isSelected ? 'bg-amber-600 text-stone-950 font-bold' : isWeekendDay ? 'bg-stone-950/20 text-stone-700 cursor-not-allowed' : 'bg-stone-950 hover:border-amber-400 border border-stone-800'} ${isDisabled && !isWeekendDay ? 'opacity-30 cursor-not-allowed line-through' : ''}" ${isDisabled ? "disabled" : ""} onclick="window.pickDate('${k}')">${d}</button>`;
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
            const dayBlock = blockedSlotsList.find(b => b.date === sel && b.type === 'day');
            const slotBlocks = blockedSlotsList.filter(b => b.date === sel && b.type === 'slot');

            h += `<div class="mt-6 pt-6 border-t border-stone-800 space-y-4">
                <p class="text-sm font-semibold text-amber-400">Data selezionata: ${it(sel)}</p>`;

            if (isWeekend(sel)) {
                h += `
                    <div class="bg-stone-900 border border-stone-800 p-4 rounded-xl text-center space-y-1">
                        <p class="text-stone-300 font-medium text-sm">Chiusura settimanale</p>
                        <p class="text-stone-500 text-xs italic">Il sabato e la domenica lo studio è chiuso.</p>
                    </div>`;
            } else if (dayBlock) {
                h += `
                    <div class="bg-red-950/40 border border-red-800/60 p-4 rounded-xl text-center space-y-1">
                        <p class="text-red-300 font-semibold text-sm">Giornata non disponibile per le prenotazioni</p>
                        <p class="text-stone-400 text-xs italic">Motivo: ${dayBlock.reason || 'Chiusura straordinaria'}</p>
                    </div>`;
            } else {
                if (slotBlocks.length > 0) {
                    h += `<div class="bg-amber-950/30 border border-amber-800/50 p-3 rounded-xl text-xs space-y-1">
                        <p class="text-amber-300 font-medium">Nota per questa giornata:</p>
                        <ul class="list-disc list-inside text-stone-400 space-y-0.5">`;
                    slotBlocks.forEach(sb => {
                        const hCount = sb.hours || 1;
                        const motivazione = sb.reason && sb.reason.trim() !== '' ? sb.reason : 'Riservato';
                        h += `<li>Dalle ore <b>${sb.time}</b> (${hCount} ${hCount === 1 ? 'ora' : 'ore'}) non disponibile: <i>${motivazione}</i></li>`;
                    });
                    h += `</ul></div>`;
                }

                h += `
                <div class="bg-stone-950/40 p-3 rounded-xl border border-stone-800 flex flex-col space-y-1 text-xs">
                    <span class="text-stone-300">Durata della prova: <b>1 ora</b></span>
                    <span class="text-stone-500 italic">Per durate superiori, contattare il docente</span>
                </div>

                <div>
                    <label class="block text-xs text-stone-400 mb-2">Orari Disponibili</label>
                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">`;
            
                let anyAvailable = false;
                getAvailableSlots().forEach(([t, ok]) => {
                    if (ok) anyAvailable = true;
                    const isSelectedTime = start === t;
                    h += `<button type="button" class="py-2 rounded-lg text-xs font-medium border transition ${isSelectedTime ? 'bg-amber-600 text-stone-950 font-bold' : ok ? 'bg-stone-950 border-stone-800 hover:border-amber-400 text-stone-300' : 'bg-stone-950 border-stone-900 text-stone-700 line-through cursor-not-allowed'}" ${ok ? '' : 'disabled'} onclick="window.pickTime(${t})">${hm(t)}</button>`;
                });
                h += `</div>`;
                if (!anyAvailable) h += `<p class="text-xs text-stone-500 mt-2">Nessun orario disponibile per questo giorno.</p>`;
                h += `</div>`;

                // Selezionato l'orario, mostra il form dati (correttamente esterno ai controlli di blocco)
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
                            <button type="button" id="w-go" onclick="window.submitWidgetBooking()" class="w-full py-3 bg-amber-600 text-stone-950 font-semibold rounded-lg hover:bg-amber-500 text-sm">Conferma Prenotazione (${hm(start)} - ${hm(start + 60)})</button>
                        </div>`;
                }
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
            duration: 60,
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
                done = { name, surname, date: sel, start, duration: 60, instrument };
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

    let adminMon = new Date(), adminSelDate = null;
    adminMon.setDate(1);

    function renderAdminCalendar() {
        const container = document.getElementById('admin-mini-calendar');
        if (!container) return;

        const y = adminMon.getFullYear(), mo = adminMon.getMonth();
        const first = (new Date(y, mo, 1).getDay() + 6) % 7;
        const dim = new Date(y, mo + 1, 0).getDate();

        let cal = `<div class="flex justify-between items-center mb-3">
            <button type="button" onclick="window.moveAdminMonth(-1)" class="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded hover:border-amber-400 text-xs text-stone-200">‹</button>
            <b class="font-serif capitalize text-amber-400 text-xs">${adminMon.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</b>
            <button type="button" onclick="window.moveAdminMonth(1)" class="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded hover:border-amber-400 text-xs text-stone-200">›</button>
        </div>`;

        cal += `<div class="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 mb-1">`;
        ["L", "M", "M", "G", "V", "S", "D"].forEach(x => cal += `<span>${x}</span>`);
        cal += `</div><div class="grid grid-cols-7 gap-1 text-center text-xs">`;

        for (let i = 0; i < first; i++) cal += `<span></span>`;
        for (let d = 1; d <= dim; d++) {
            const k = y + "-" + pad(mo + 1) + "-" + pad(d);
            const isSelected = k === adminSelDate;
            cal += `<button type="button" class="py-1.5 rounded text-xs transition ${isSelected ? 'bg-amber-600 text-stone-950 font-bold' : 'bg-stone-900 hover:border-amber-400 border border-stone-800 text-stone-300'}" onclick="window.pickAdminDate('${k}')">${d}</button>`;
        }
        cal += `</div>`;

        container.innerHTML = cal;
    }

    window.moveAdminMonth = function(n) {
        adminMon.setMonth(adminMon.getMonth() + n);
        renderAdminCalendar();
    };

    window.pickAdminDate = function(k) {
        adminSelDate = k;
        document.getElementById('block-date').value = k;
        const display = document.getElementById('admin-calendar-container');
        if (display) {
            display.textContent = new Date(k + "T12:00").toLocaleDateString("it-IT", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            display.className = "inline-block px-3 py-1.5 bg-stone-950 border gold-border rounded-lg text-amber-400 text-xs font-semibold";
        }
        renderAdminCalendar();
    };

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
                    renderAdminCalendar(); // Inizializza il mini calendario all'accesso
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

    // Gestione visibilità selettore orario e ore nel form blocchi admin
    const blockTypeSelect = document.getElementById('block-type');
    const blockTimeWrapper = document.getElementById('block-time-wrapper');
    const blockDurationWrapper = document.getElementById('block-duration-wrapper');

    if (blockTypeSelect) {
        blockTypeSelect.addEventListener('change', () => {
            if (blockTypeSelect.value === 'day') {
                if (blockTimeWrapper) blockTimeWrapper.classList.add('hidden');
                if (blockDurationWrapper) blockDurationWrapper.classList.add('hidden');
            } else {
                if (blockTimeWrapper) blockTimeWrapper.classList.remove('hidden');
                if (blockDurationWrapper) blockDurationWrapper.classList.remove('hidden');
            }
        });
    }

    // Funzione globale per inviare il blocco
    window.submitAdminBlock = async function() {
        const type = document.getElementById('block-type').value;
        const dateVal = document.getElementById('block-date').value;
        const timeVal = type === 'slot' ? document.getElementById('block-time').value : null;
        const hoursVal = type === 'slot' ? parseInt(document.getElementById('block-hours').value) || 1 : null;
        const reasonVal = document.getElementById('block-reason')?.value.trim() || 'Chiuso';

        if (!dateVal) {
            alert('Seleziona una data dal mini calendario.');
            return;
        }

        const payload = {
            type: type,
            date: dateVal,
            time: timeVal,
            hours: hoursVal,
            reason: reasonVal
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
                document.getElementById('block-reason').value = '';
                adminSelDate = null;
                document.getElementById('block-date').value = '';
                const display = document.getElementById('admin-calendar-container');
                if (display) display.textContent = 'Clicca un giorno sotto';
                loadAdminData();
                renderCalendarWidget();
                renderAdminCalendar();
            } else {
                alert('Errore: ' + json.message);
            }
        } catch (err) {
            alert('Errore di connessione.');
        }
    };

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

        // 1. Tabella Prove Prenotate ordinate cronologicamente in formato italiano
        const tbodyB = document.getElementById('admin-bookings-table');
        if (tbodyB) {
            tbodyB.innerHTML = '';
            if (existingBookings.length > 0) {
                existingBookings.sort((a, b) => {
                    if (a.date !== b.date) {
                        return a.date.localeCompare(b.date);
                    }
                    return a.time.localeCompare(b.time);
                });

                existingBookings.forEach(b => {
                    const dataItaliana = new Date(b.date + "T12:00").toLocaleDateString("it-IT", { 
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                    });

                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-stone-800 hover:bg-stone-950/40';
                    tr.innerHTML = `
                        <td class="p-3 capitalize text-stone-300">${dataItaliana}</td>
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

        // Sondaggi
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

        // Tabella Blocchi Attivi
        const tbodyBl = document.getElementById('admin-blocks-table');
        if (tbodyBl) {
            tbodyBl.innerHTML = '';
            if (blockedSlotsList.length > 0) {
                blockedSlotsList.forEach(b => {
                    const hours = b.hours || 1;
                    const timeDisplay = b.time ? `${b.time} (${hours} ${hours === 1 ? 'ora' : 'ore'})` : '-';
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-stone-800 hover:bg-stone-950/40';
                    tr.innerHTML = `
                        <td class="p-2.5 font-semibold text-amber-400">${b.type === 'day' ? 'Intera Giornata' : 'Fascia Oraria'}</td>
                        <td class="p-2.5">${b.date}</td>
                        <td class="p-2.5">${timeDisplay}</td>
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