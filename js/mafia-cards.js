/* Mafia – 100 różnych kart mocy (tryb „każdy swój telefon”).
   team:   'mafia' | 'town' (miasto) | 'all' (dla każdego)
   when:   'night' (tajnie, w nocy) | 'day' (w dyskusji, jawnie) | 'vote' (w głosowaniu) | 'passive' (działa sama, gdy leży w ręce)
   target: 'none' | 'other' (żywy gracz poza tobą) | 'dead' (martwy gracz)
   fx:     lista efektów obsługiwanych przez resolveNight / playDay / resolveVote / hooki pasywne */
(function (root) {
'use strict';
const L = [
  // ---------- NOC: ochrona ----------
  ['kamizelka', 'Kamizelka', '🦺', 'all', 'night', 'none', 'Tej nocy nikt nie może cię zabić.', [{ op: 'protect', who: 'self' }]],
  ['apteczka', 'Apteczka', '💉', 'town', 'night', 'other', 'Chronisz wybraną osobę tej nocy.', [{ op: 'protect', who: 'target' }]],
  ['ochroniarz', 'Ochroniarz', '💂', 'town', 'night', 'other', 'Chronisz wybraną osobę i rano wiesz, kto ją w nocy odwiedził.', [{ op: 'protect', who: 'target' }, { op: 'watch' }]],
  ['bunkier', 'Bunkier', '🏚️', 'all', 'night', 'none', 'Chowasz się: nikt cię nie zabije, ale twój ruch tej nocy przepada.', [{ op: 'protect', who: 'self' }, { op: 'selfblock' }]],
  ['sejf', 'Sejf', '🔐', 'all', 'night', 'none', 'Tej nocy jesteś bezpieczny, a nikt nie podejrzy twoich kart.', [{ op: 'protect', who: 'self' }, { op: 'hidehand' }]],
  ['lekarstwo', 'Lekarstwo', '💊', 'all', 'night', 'other', 'Leczysz wybraną osobę – tej nocy przeżyje atak.', [{ op: 'protect', who: 'target' }]],
  ['antidotum', 'Antidotum', '🧪', 'town', 'night', 'other', 'Chronisz osobę i usuwasz z niej truciznę.', [{ op: 'protect', who: 'target' }, { op: 'cure' }]],
  ['eskorta', 'Areszt ochronny', '🚓', 'town', 'night', 'other', 'Wybrana osoba jest bezpieczna, ale nie wykona tej nocy ruchu.', [{ op: 'protect', who: 'target' }, { op: 'block' }]],
  ['kryjowka', 'Kryjówka', '🏠', 'all', 'night', 'none', 'Spędzasz noc w kryjówce – atak cię nie dosięgnie.', [{ op: 'protect', who: 'self' }]],
  // ---------- NOC: śledztwa ----------
  ['lupa', 'Lupa', '🔍', 'town', 'night', 'other', 'Rano dowiesz się, czy wybrana osoba jest w mafii.', [{ op: 'inv', kind: 'mafia' }]],
  ['teczka', 'Teczka', '📁', 'town', 'night', 'other', 'Rano poznasz dokładną rolę wybranej osoby.', [{ op: 'inv', kind: 'role' }]],
  ['latarka', 'Latarka', '🔦', 'all', 'night', 'other', 'Rano dowiesz się, czy wybrana osoba ma specjalną rolę.', [{ op: 'inv', kind: 'special' }]],
  ['kartoteka', 'Kartoteka', '🗂️', 'town', 'night', 'other', 'Sprawdzasz, po której stronie gra wybrana osoba.', [{ op: 'inv', kind: 'mafia' }]],
  ['informator', 'Informator', '🐀', 'all', 'night', 'other', 'Szczur z miasta powie ci, czy wybrana osoba jest w mafii.', [{ op: 'inv', kind: 'mafia' }]],
  ['kontrwywiad', 'Kontrwywiad', '🛰️', 'mafia', 'night', 'other', 'Mafia sprawdza dokładną rolę wybranej osoby.', [{ op: 'inv', kind: 'role' }]],
  ['donos', 'Donos', '📨', 'mafia', 'night', 'other', 'Dowiesz się, czy wybrana osoba ma specjalną rolę.', [{ op: 'inv', kind: 'special' }]],
  ['podsluch', 'Podsłuch', '🎧', 'town', 'night', 'other', 'Rano wiesz, kto w nocy odwiedził wybraną osobę.', [{ op: 'watch' }]],
  ['swiadek', 'Świadek', '👁️', 'town', 'night', 'other', 'Widziałeś, kto kręcił się nocą przy wybranej osobie.', [{ op: 'watch' }]],
  ['luneta', 'Luneta', '🔭', 'all', 'night', 'other', 'Obserwujesz dom wybranej osoby – rano wiesz, kto do niej przyszedł.', [{ op: 'watch' }]],
  ['sledzenie', 'Śledzenie', '👣', 'town', 'night', 'other', 'Rano wiesz, kogo wybrana osoba odwiedziła w nocy.', [{ op: 'track' }]],
  ['kamera', 'Kamera', '📹', 'town', 'night', 'other', 'Nagrywasz wybraną osobę – rano wiesz, na kogo działała.', [{ op: 'track' }]],
  ['sekcja', 'Sekcja zwłok', '🔬', 'town', 'night', 'dead', 'Poznajesz prawdziwą rolę wybranej martwej osoby.', [{ op: 'autopsy' }]],
  ['medium', 'Medium', '🕯️', 'all', 'night', 'dead', 'Rozmawiasz z duchem – poznajesz jego prawdziwą rolę.', [{ op: 'autopsy' }]],
  ['podglad', 'Podgląd', '👀', 'all', 'night', 'other', 'Rano zobaczysz karty wybranej osoby.', [{ op: 'peek' }]],
  ['sieci', 'Sieć', '🕸️', 'town', 'night', 'other', 'Łapiesz osobę w sieć: nie wykona ruchu, a ty dowiesz się, czy jest w mafii.', [{ op: 'block' }, { op: 'inv', kind: 'mafia' }]],
  ['alarm', 'Alarm', '🚨', 'town', 'night', 'none', 'Jeśli ktoś cię dziś zaatakuje, poznasz imię napastnika.', [{ op: 'alarm' }]],
  ['pulapka', 'Pułapka', '🪤', 'town', 'night', 'none', 'Jeśli mafia cię dziś zaatakuje, telewizor ujawni jednego mafioza!', [{ op: 'trap' }]],
  // ---------- NOC: blokady i zmyłki ----------
  ['kajdanki', 'Kajdanki', '⛓️', 'all', 'night', 'other', 'Wybrana osoba nie wykona tej nocy ruchu ani karty.', [{ op: 'block' }]],
  ['przekupstwo_nocne', 'Łapówka', '💰', 'mafia', 'night', 'other', 'Przekupujesz osobę – tej nocy nic nie zrobi.', [{ op: 'block' }]],
  ['sen', 'Kołysanka', '💤', 'mafia', 'night', 'other', 'Usypiasz wybraną osobę – przesypia swój ruch.', [{ op: 'block' }]],
  ['szantaz', 'Szantaż', '📸', 'mafia', 'night', 'other', 'Blokujesz osobę i podglądasz jej karty.', [{ op: 'block' }, { op: 'peek' }]],
  ['lustro', 'Lustro', '🪞', 'all', 'night', 'none', 'Kto cię dziś sprawdzi, zobaczy odwrotny wynik.', [{ op: 'look', who: 'self', as: 'flip' }]],
  ['maska', 'Maska', '🎭', 'mafia', 'night', 'none', 'Tej nocy wyglądasz na niewinnego przy każdym sprawdzeniu.', [{ op: 'look', who: 'self', as: 'town' }]],
  ['alibi', 'Alibi', '🧾', 'all', 'night', 'none', 'Masz alibi – śledztwa pokażą, że jesteś czysty.', [{ op: 'look', who: 'self', as: 'town' }]],
  ['wrobienie', 'Wrobienie', '🖼️', 'mafia', 'night', 'other', 'Podrzucasz dowody – wybrana osoba wygląda na mafię.', [{ op: 'look', who: 'target', as: 'mafia' }]],
  ['peruka', 'Peruka', '👱', 'mafia', 'night', 'other', 'Przebierasz kogoś – przy sprawdzeniu wyjdzie odwrotny wynik.', [{ op: 'look', who: 'target', as: 'flip' }]],
  ['sabotaz', 'Sabotaż', '🔧', 'mafia', 'night', 'none', 'Psujesz sprzęt lekarza – jego ochrona tej nocy nie działa.', [{ op: 'sabotage' }]],
  ['cichy', 'Tłumik', '🤫', 'mafia', 'night', 'none', 'Rola dzisiejszej ofiary mafii pozostanie tajemnicą.', [{ op: 'silent' }]],
  // ---------- NOC: ataki ----------
  ['zlecenie', 'Zlecenie', '🎯', 'mafia', 'night', 'other', 'Dodatkowy zamach: wybrana osoba też zostanie zaatakowana.', [{ op: 'kill' }]],
  ['noz', 'Nóż', '🔪', 'mafia', 'night', 'other', 'Cichy atak na wybraną osobę.', [{ op: 'kill' }]],
  ['trucizna', 'Trucizna', '☠️', 'mafia', 'night', 'other', 'Trujesz osobę – umrze następnej nocy, chyba że ktoś ją ochroni.', [{ op: 'poison' }]],
  ['samosad', 'Samosąd', '⚖️', 'town', 'night', 'other', 'Bierzesz sprawy w swoje ręce i atakujesz wybraną osobę. Uważaj na pomyłkę!', [{ op: 'kill' }]],
  // ---------- DZIEŃ: czas ----------
  ['dogrywka', 'Dogrywka', '⏱️', 'all', 'day', 'none', '+60 sekund dyskusji.', [{ op: 'time', sec: 60 }]],
  ['klepsydra', 'Klepsydra', '⏳', 'all', 'day', 'none', '+30 sekund dyskusji.', [{ op: 'time', sec: 30 }]],
  ['pospiech', 'Pośpiech', '⏩', 'all', 'day', 'none', 'Skraca dyskusję o 30 sekund.', [{ op: 'time', sec: -30 }]],
  ['gong', 'Gong', '🔔', 'mafia', 'day', 'none', 'Koniec gadania! Dyskusja skraca się o 60 sekund.', [{ op: 'time', sec: -60 }]],
  ['megafon', 'Megafon', '📣', 'all', 'day', 'other', 'Wybrana osoba musi się bronić – +30 sekund tylko dla niej.', [{ op: 'spotlight' }, { op: 'time', sec: 30 }]],
  ['przesluchanie', 'Przesłuchanie', '🎙️', 'town', 'day', 'other', 'Wybrana osoba odpowiada na 3 pytania miasta (+30 s).', [{ op: 'spotlight' }, { op: 'time', sec: 30 }]],
  // ---------- DZIEŃ: informacje ----------
  ['gazeta', 'Gazeta', '📰', 'all', 'day', 'none', 'Telewizor ogłasza, ilu mafiozów jeszcze żyje.', [{ op: 'count' }]],
  ['fake_news', 'Fałszywa gazeta', '🗞️', 'mafia', 'day', 'none', 'Telewizor ogłasza ZŁĄ liczbę żyjących mafiozów.', [{ op: 'fakecount' }]],
  ['kula', 'Kula', '🔮', 'town', 'day', 'none', 'Telewizor pokazuje 3 osoby – co najmniej jedna jest w mafii.', [{ op: 'crystal', n: 3 }]],
  ['tarot', 'Karty tarota', '🎴', 'all', 'day', 'none', 'Telewizor pokazuje 4 osoby – co najmniej jedna jest w mafii.', [{ op: 'crystal', n: 4 }]],
  ['wyrocznia', 'Wyrocznia', '🏛️', 'town', 'day', 'none', 'Telewizor pokazuje 2 osoby – co najmniej jedna jest w mafii.', [{ op: 'crystal', n: 2 }]],
  ['czyste_konto', 'Czyste konto', '😇', 'town', 'day', 'none', 'Telewizor ogłasza jedną losową osobę, która NIE jest w mafii.', [{ op: 'clear' }]],
  ['swiadectwo', 'Świadectwo', '📜', 'all', 'day', 'none', 'Telewizor oczyszcza z podejrzeń jedną losową niewinną osobę.', [{ op: 'clear' }]],
  ['cmentarz', 'Cmentarz', '🪦', 'town', 'day', 'none', 'Telewizor ujawnia role wszystkich zmarłych.', [{ op: 'deadroles' }]],
  ['plotka', 'Plotka', '🗣️', 'mafia', 'day', 'none', 'Telewizor ogłasza „podejrzaną” losową niewinną osobę.', [{ op: 'rumor' }]],
  ['statystyka', 'Statystyka', '📊', 'all', 'day', 'none', 'Telewizor ogłasza, ile specjalnych ról jeszcze żyje.', [{ op: 'specialcount' }]],
  ['rentgen', 'Rentgen', '🩻', 'all', 'day', 'other', 'Widzisz karty wybranej osoby (tylko ty).', [{ op: 'peek' }]],
  // ---------- DZIEŃ: karty ----------
  ['kradziez', 'Kradzież', '🧤', 'all', 'day', 'other', 'Zabierasz losową kartę wybranej osobie.', [{ op: 'steal' }]],
  ['kieszonkowiec', 'Kieszonkowiec', '🤏', 'mafia', 'day', 'other', 'Po cichu zabierasz losową kartę wybranej osobie.', [{ op: 'steal', quiet: true }]],
  ['niszczarka', 'Niszczarka', '🗑️', 'all', 'day', 'other', 'Wybrana osoba traci losową kartę.', [{ op: 'destroy' }]],
  ['wymiana', 'Wymiana', '🔄', 'all', 'day', 'other', 'Zamieniasz się wszystkimi kartami z wybraną osobą.', [{ op: 'swap' }]],
  ['los', 'Szczęśliwy los', '🍀', 'all', 'day', 'none', 'Dobierasz 1 losową kartę.', [{ op: 'draw', n: 1 }]],
  ['jednoreki', 'Jednoręki bandyta', '🎰', 'all', 'day', 'none', 'Dobierasz 2 losowe karty.', [{ op: 'draw', n: 2 }]],
  ['joker', 'Joker', '🤹', 'all', 'day', 'none', 'Losowy efekt dnia: czas, gazeta, kula albo nowa karta.', [{ op: 'random' }]],
  ['amnestia', 'Amnestia', '🏳️', 'all', 'day', 'none', 'W dzisiejszym głosowaniu nikt nie odpadnie.', [{ op: 'vetonext' }]],
  ['rozejm', 'Rozejm', '🤝', 'town', 'day', 'none', 'Najbliższej nocy mafia nie zaatakuje.', [{ op: 'truce' }]],
  // ---------- GŁOSOWANIE ----------
  ['podwojny', 'Podwójny głos', '✌️', 'all', 'vote', 'none', 'Twój głos liczy się podwójnie.', [{ op: 'weight', n: 2 }]],
  ['potrojny', 'Potrójny głos', '🤟', 'all', 'vote', 'none', 'Twój głos liczy się potrójnie.', [{ op: 'weight', n: 3 }]],
  ['knebel', 'Knebel', '🤐', 'all', 'vote', 'other', 'Wybrana osoba nie głosuje w tym głosowaniu.', [{ op: 'gag' }]],
  ['zastraszenie', 'Zastraszenie', '😠', 'mafia', 'vote', 'other', 'Zastraszona osoba nie odważy się zagłosować.', [{ op: 'gag' }]],
  ['przekupstwo', 'Przekupstwo', '💵', 'mafia', 'vote', 'other', 'Głos wybranej osoby będzie taki sam jak twój.', [{ op: 'bribe' }]],
  ['weto', 'Weto', '🛑', 'all', 'vote', 'none', 'W tym głosowaniu nikt nie odpada (wyjdzie na jaw przy wyniku).', [{ op: 'veto' }]],
  ['immunitet', 'Immunitet', '🛡️', 'all', 'vote', 'none', 'Nie możesz zostać wyrzucony w tym głosowaniu.', [{ op: 'immune', who: 'self' }]],
  ['obronca', 'Obrońca', '🧑‍⚖️', 'town', 'vote', 'other', 'Wybrana osoba nie może zostać wyrzucona.', [{ op: 'immune', who: 'target' }]],
  ['magnes', 'Magnes', '🧲', 'all', 'vote', 'other', 'Głosy oddane na ciebie przechodzą na wybraną osobę.', [{ op: 'magnet' }]],
  ['wstrzymanie', 'Wstrzymanie', '🙅', 'all', 'vote', 'none', 'Dodaje 2 głosy „Pomijam”.', [{ op: 'skipbonus', n: 2 }]],
  ['odwrocenie', 'Odwrócenie', '🔃', 'all', 'vote', 'none', 'Odpada osoba z NAJMNIEJSZĄ liczbą głosów (ale co najmniej 1).', [{ op: 'reverse' }]],
  ['tajna_urna', 'Tajna urna', '🗳️', 'all', 'vote', 'none', 'Telewizor ukrywa, kto na kogo głosuje.', [{ op: 'secret' }]],
  ['nagonka', 'Nagonka', '📢', 'all', 'vote', 'other', 'Dodaje 2 głosy przeciwko wybranej osobie.', [{ op: 'push', n: 2 }]],
  ['mur', 'Mur', '🧱', 'all', 'vote', 'none', 'Odejmuje 2 głosy oddane na ciebie.', [{ op: 'shield', n: 2 }]],
  ['sedzia', 'Młotek sędziego', '🔨', 'town', 'vote', 'none', 'Przy remisie decyduje twój głos.', [{ op: 'tiebreak' }]],
  ['lawa', 'Ława przysięgłych', '👥', 'all', 'vote', 'none', 'Rozstrzygasz remis i twój głos liczy się podwójnie.', [{ op: 'tiebreak' }, { op: 'weight', n: 2 }]],
  ['ostatnie_slowo', 'Ostatnie słowo', '💬', 'all', 'vote', 'none', '+20 sekund głosowania.', [{ op: 'votetime', sec: 20 }]],
  ['uklad', 'Układ', '🤞', 'mafia', 'vote', 'other', 'Wybrana osoba głosuje tak jak ty, a twój głos liczy się podwójnie.', [{ op: 'bribe' }, { op: 'weight', n: 2 }]],
  // ---------- PASYWNE (działają same) ----------
  ['druga_szansa', 'Druga szansa', '🕊️', 'all', 'passive', 'none', 'Jeśli zginiesz w nocy – przeżyjesz (karta się zużywa).', [{ op: 'dove' }]],
  ['kocie_zycie', 'Kocie życie', '🐈', 'all', 'passive', 'none', 'Raz przeżyjesz nocny atak.', [{ op: 'dove' }]],
  ['aniol', 'Anioł stróż', '👼', 'town', 'passive', 'none', 'Anioł raz uratuje cię przed śmiercią w nocy.', [{ op: 'dove' }]],
  ['pancerz', 'Hełm', '🪖', 'all', 'passive', 'none', 'Raz chroni przed nocnym atakiem.', [{ op: 'dove' }]],
  ['bomba', 'Bomba', '💣', 'all', 'passive', 'none', 'Gdy miasto cię wyrzuci, losowa osoba, która na ciebie głosowała, ginie z tobą.', [{ op: 'bomb' }]],
  ['klatwa', 'Klątwa', '🧿', 'mafia', 'passive', 'none', 'Gdy cię wyrzucą, jeden z głosujących na ciebie ginie.', [{ op: 'bomb' }]],
  ['zemsta', 'Zemsta', '👊', 'town', 'passive', 'none', 'Jeśli zginiesz w nocy, z 50% szansą zabierasz ze sobą mafioza.', [{ op: 'revenge' }]],
  ['tarcza', 'Tarcza', '🔰', 'all', 'passive', 'none', 'Raz chroni przed wyrzuceniem w głosowaniu.', [{ op: 'lynchsave' }]],
  ['spadochron', 'Spadochron', '🪂', 'all', 'passive', 'none', 'Gdy miasto cię wyrzuci – lądujesz bezpiecznie (raz).', [{ op: 'lynchsave' }]],
  ['polisa', 'Polisa', '📄', 'all', 'passive', 'none', 'Gdy zginiesz, twoje karty trafią do losowych żywych graczy.', [{ op: 'insurance' }]],
  ['kamuflaz', 'Kamuflaż', '🦎', 'mafia', 'passive', 'none', 'Dopóki masz tę kartę, śledztwa pokazują, że jesteś niewinny.', [{ op: 'camo' }]],
  ['czujnik', 'Czujnik ruchu', '📡', 'town', 'passive', 'none', 'Gdy ktoś cię zaatakuje, poznasz imię napastnika.', [{ op: 'alarmp' }]],
  ['talizman', 'Talizman', '📿', 'all', 'passive', 'none', 'Nikt nie może cię zablokować (kajdanki, łapówki…).', [{ op: 'unblockable' }]],
  ['echo', 'Echo', '🔊', 'all', 'passive', 'none', 'Knebel zagrany na ciebie odbija się na osobę, która go zagrała.', [{ op: 'reflect' }]],
];
const CARDS = {};
L.forEach(([key, name, emoji, team, when, target, desc, fx]) => { CARDS[key] = { key, name, emoji, team, when, target, desc, fx }; });
const HAND_MAX = 3;
const has = (k, op) => CARDS[k] && CARDS[k].fx.some(f => f.op === op);
const pool = team => Object.keys(CARDS).filter(k => CARDS[k].team === 'all' || CARDS[k].team === team);

/* ---------- talia (każda karta raz; gdy się skończy – odzyskujemy zużyte) ---------- */
function makeDeck(rnd = Math.random) {
  const d = Object.keys(CARDS);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
/** Dobierz kartę pasującą do drużyny. inPlay – karty w rękach/ofertach (nie mogą się dublować). */
function drawFor(deck, team, inPlay) {
  let i = deck.findIndex(k => team === 'any' || CARDS[k].team === 'all' || CARDS[k].team === team);
  if (i < 0) { // przetasuj zużyte
    const busy = new Set(inPlay);
    makeDeck().filter(k => !busy.has(k) && !deck.includes(k)).forEach(k => deck.push(k));
    i = deck.findIndex(k => team === 'any' || CARDS[k].team === 'all' || CARDS[k].team === team);
    if (i < 0) return null;
  }
  return deck.splice(i, 1)[0];
}

const API = { CARDS, HAND_MAX, has, pool, makeDeck, drawFor, COUNT: L.length };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.MafiaCards = API;
})(typeof window !== 'undefined' ? window : globalThis);
