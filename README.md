# 🎉 Gry imprezowe na telewizor: Impostor, Mafia i Kalambury

Telewizor pokazuje grę (lobby, instrukcje, odliczanie, głosowania, wyniki, animacje, muzykę), a gracze używają telefonów.
Na starcie telewizora wybierasz **grę** (🕵️ Impostor, 🌙 Mafia albo ✏️ Kalambury), a potem **tryb**: 📱 jeden telefon krążący między graczami albo 👥 każdy swój telefon.

## ✏️ Kalambury
Jedna osoba rysuje palcem na telefonie, a rysunek pojawia się **na żywo na telewizorze**. Reszta zgaduje.
- Rysujący wybiera 1 z 3 haseł (z tych samych ~6000 słów i kategorii co Impostor). Na TV widać kategorię i hasło jako kreski `_ _ _ _`. W trakcie rundy odsłaniają się 2 litery.
- **Narzędzia:** 8 kolorów, 3 grubości, gumka, cofnij, wyczyść i kolor tła.
- **Zgadywanie:** wszyscy krzyczą odpowiedzi na głos. Rysujący klika na telefonie, kto zgadł pierwszy, i ta osoba wygrywa rundę (+2 pkt).
- **Poziomy (łatwy / normalny / trudny):** rysujący wybiera 1 z 3 słów: ⭐ najłatwiejsze, ⭐⭐ średnie, ⭐⭐⭐ najtrudniejsze. Jeśli ktoś zgadnie, rysujący dostaje 1, 2 albo 3 pkt, zależnie od wybranego słowa. Tryb decyduje, jak trudne są słowa do wyboru. Jest też przycisk „Nikt nie zgadł”.
- **Jeden telefon** (`draw.html`): telefon przechodzi do rysującego, zasady są te same.
- **Ustawienia:** czas 60–120 s, obiegi 1–3 (ile razy każdy rysuje) i kategorie.
- **Na koniec:** podium i galeria wszystkich rysunków z gry.

## 🌙 Mafia
Miasto kontra mafia. Telewizor jest narratorem i czyta komunikaty na głos po polsku (synteza mowy przeglądarki; bez polskiego głosu zostają napisy).
- **Role:** 🕴️ Mafia (w nocy wspólnie wybiera ofiarę, mafiozi znają się nawzajem), 🕵️ Policjant (sprawdza, czy ktoś jest w mafii), 🩺 Lekarz (ratuje jedną osobę, nie tę samą dwie noce z rzędu), 🙂 Obywatele.
- **Noc:** każdy coś klika, obywatele wskazują podejrzanego, żeby nikt nie zgadł ról po zachowaniu.
- **Rano:** telewizor ogłasza ofiarę (i jej rolę, jeśli to włączone) albo że lekarz kogoś uratował.
- **Dzień i głosowanie:** dyskusja z odliczaniem, potem głosowanie żywych (można „Pominąć”). Remis = nikt nie odpada.
- **⏭ Pomiń dzień:** każdy żywy gracz może na telefonie kliknąć „Pomiń dzień”. Gdy kliknie większość, dyskusja kończy się i od razu jest głosowanie.
- **Wygrana:** miasto, gdy usunie całą mafię; mafia, gdy jest jej tyle, co reszty żywych. Zwycięska drużyna +2 pkt, żywi zwycięzcy +1.
- **Tryb jednego telefonu:** `mafia.html` na telefonie hosta. W nocy telewizor woła po kolei każdego gracza do telefonu.
- **Tryb „każdy swój telefon”:** wszystko odbywa się na telefonach, a ustawienia robisz pilotem na TV.

### 🃏 Karty mocy (tryb „każdy swój telefon”)
- **100 różnych kart**: 22 dla mafii, 27 dla miasta i 51 dla każdego.
- **Telewizor rozdaje je losowo co rano** (ustawienie „Karty co rano”: 1–3 osoby albo wyłączone). Każdy dostaje karty pasujące do swojej drużyny. W ręce można mieć maksymalnie 3 karty.
- **Duchy** (zabici gracze) co rano dostają **2 losowe karty** i mogą je przekazać żywym graczom.
- **Rodzaje:**
  - nocne (tajne): ochrona, śledztwa, podsłuch, blokady, zmyłki, dodatkowe ataki, trucizna;
  - dzienne (jawne, telewizor je ogłasza): czas, gazeta, kula, kradzież, wymiana;
  - na głosowanie: podwójny głos, knebel, weto, immunitet, magnes, odwrócenie;
  - pasywne: działają same, gdy leżą w ręce (druga szansa, bomba, zemsta, tarcza).
- W jednej fazie można zagrać jedną kartę. Wyniki nocnych śledztw przychodzą rano, tylko do ciebie.

## 🧪 Tryb testowy (jedna osoba gra za wszystkich)
Otwórz **`vcbgf5.github.io/Impostorgame/test`** (albo `test.html`) na komputerze. Zobaczysz telewizor i obok **telefony graczy (3–12)**, które same dołączają do gry. Każdym telefonem klikasz jak prawdziwy gracz.
- **Szybkie linki (4 osoby w jednym oknie):** `vcbgf5.github.io/Impostorgame/test-impostor` i `vcbgf5.github.io/Impostorgame/test-kalambury`. Na stronie testu są też przyciski „🕵️ Impostor · 4”, „✏️ Kalambury · 4”, „🌙 Mafia · 6”.
- Wybierz grę (Mafia / Impostor / Kalambury) i liczbę graczy, potem „▶ Uruchom od nowa”.
- „🪟 Gracze w osobnych oknach” otwiera każdego gracza w osobnym oknie (albo kliknij linki pod telewizorem).
- Wszystko działa lokalnie w tej przeglądarce: bez internetu i bez kodu.
- **🎬 Osobna strona testu animacji:** `vcbgf5.github.io/Impostorgame/testanim`. Duży telewizor, telefon, przycisk dla każdej animacji i „▶ Odtwórz wszystkie po kolei”.
- **🎬 Test animacji:** przyciski pod telewizorem odpalają każdą animację od razu. Na TV: zabójstwo, trucizna, obrona, gołąb, wyrzucenie, bomba, noc, dzień, koniec gry. Na telefonie: śledztwo, teczka, tarcza, alarm, zlecenie, śmierć.

---


## 🕵️ Impostor – dwa tryby (wybierasz na telewizorze pilotem: strzałki + OK)
- **📱 Jeden telefon**: host ma telefon, który krąży między graczami (opis poniżej).
- **👥 Każdy swój telefon**: telewizor prowadzi grę. Gracze skanują QR z TV (albo wchodzą na `…/play` i wpisują kod), podają imię i dołączają. Każdy widzi swoje słowo u siebie i klika „Widziałem”. Głosuje na swoim telefonie, a impostor wybiera słowo z 10 też u siebie. Kategorie, zasady, start, następną rundę i usuwanie graczy robisz **pilotem na telewizorze**. Telewizor sam przechodzi dalej, gdy wszyscy zagłosują albo skończy się czas.

Test lokalny trybu wielu telefonów w jednej przeglądarce: `tv.html` w jednej karcie i kilka kart `play.html?local=1` (każda karta to osobny gracz).

## Tryb jednego telefonu – jak to działa

1. **Laptop + TV**: otwórz `tv.html` (F11 = pełny ekran). Laptop podłączasz kablem HDMI albo w Chrome wybierasz *⋮ → Przesyłaj → Przesyłaj kartę* na Chromecasta. Na ekranie pojawi się **kod (np. `KAE4`) i QR**.
2. **Telefon hosta**: zeskanuj QR albo otwórz `index.html` i wpisz kod. Telefon łączy się z laptopem przez WebRTC (PeerJS). Nie trzeba konta, rejestracji ani aplikacji na telewizorze. Oba urządzenia potrzebują internetu.
3. Host dodaje graczy (kolejność = kolejność podawania telefonu), wybiera kategorie i zasady.
4. **Rozdawanie ról**: telewizor pokazuje, komu podać telefon. Gracz klika „To ja”, **przytrzymuje kafelek** (kafelek się podnosi i widać słowo), puszcza go, klika „Podaj dalej”.
   - Załoga widzi słowo i kategorię.
   - Impostor widzi „JESTEŚ IMPOSTOREM” i, jeśli host włączył podpowiedź, ogólne hasło (np. słowo „banan” → podpowiedź „owoc”).
5. **Dyskusja**: z czasem (1–5 min) albo bez limitu. Na TV jest odliczanie i kolejność mówienia. Opcja „Ktoś zapomniał słowa?” pozwala komuś podejrzeć słowo jeszcze raz.
6. **Głosowanie** (domyślnie 30 s): na trzy wszyscy wskazują podejrzanego, a host zaznacza przy każdym graczu, kogo wskazał. Na TV na żywo rosną paski z awatarami głosujących.
7. **Wynik**: werbel → kogo wyrzucono → pieczątka „BYŁ / NIE BYŁ IMPOSTOREM” → na TV pojawia się 10 słów (prawdziwe + 9 podobnych z tej samej grupy), impostor wybiera jedno, a host zaznacza je na telefonie → słowo na TV → punkty → tabela.

### Tryby gry
- **🎯 Klasyczny**: impostor nie zna słowa (może dostać podpowiedź).
- **🎭 Podwójny agent**: impostor dostaje *podobne* słowo (np. „kot” zamiast „pies”) i **nie wie**, że jest impostorem.
- **⚡ Błyskawica**: 45 s dyskusji i 15 s głosowania.
- **🏁 Gra do X punktów** (10/15/20): kto pierwszy dobije, wygrywa. Na TV pojawia się podium z koroną.

### Dźwięki, emoji i reakcje
- **Piosenki (7):** każdy ekran i tryb ma swoją.
  | Kiedy | Utwór |
  |---|---|
  | wybór trybu, rozdawanie ról | `music_menu` – chillowy groove |
  | lobby | `music_lobby` – szpiegowski groove |
  | dyskusja (Klasyczny) | `music_tension` – napięcie |
  | dyskusja (Podwójny agent) | `music_double` – noirowe tango |
  | dyskusja i głosowanie (Błyskawica) | `music_blitz` – szybki chiptune |
  | głosowanie | `music_vote` – pulsujący beat |
  | tabela wyników | `music_victory` – radosny hit |
- **Efekty:** dżingiel startu rundy, 3 wersje dzwonka dołączenia, odliczanie „3-2-1” przed głosowaniem, tykanie, brzęczyk, werbel, pieczątka, „dun dun DUNN” przy odkryciu impostora, cyrkowa melodyjka trolla, fanfary, „wah wah”. Powtarzające się efekty grają za każdym razem lekko inną wysokością (pitch), więc się nie nudzą.
- Dźwięki to pliki **mp3 w folderze `sounds/`**. Są w 100% nasze (wygenerowane skryptem `tools/make_sounds.py`, numpy + ffmpeg), więc nie ma problemu z licencją. Żeby podmienić dźwięk, wrzuć własny mp3 o tej samej nazwie (np. `sounds/fanfare.mp3`). Gdy pliku brak, gra użyje zapasowego dźwięku generowanego w przeglądarce.
- Przycisk 🔊 jest w prawym górnym rogu (pilotem: strzałka w górę → OK). Przeglądarka włączy dźwięk dopiero po pierwszym naciśnięciu OK albo kliknięciu.
- Każdy gracz ma awatar emoji. W trybie jednego telefonu zmieniasz go, klikając awatar, a w trybie wielu telefonów wybiera go gracz.
- W trybie „każdy swój telefon” na dole telefonu jest pasek reakcji 😂😱🤔🔥. Wysłane reakcje wylatują na telewizorze.

### Tryb trolla 🤡
Ustawiasz szansę (10/20/35%), że w danej rundzie **wszyscy** są impostorami. W głosowaniu jest dodatkowa opcja „To troll – wszyscy!”.

### Punkty
| Sytuacja | Punkty |
|---|---|
| Impostor wyeliminowany | +1 dla każdego, kto zagłosował na impostora |
| Impostor niezłapany (lub remis) | +2 dla impostora |
| Impostor zgadł słowo | +2 dla impostora |
| Wykryliście rundę trolla (wygrał „troll”) | +1 dla każdego, kto głosował „troll” |

## Słowa (folder `words/`)
Około 6000 słów w 26 kategoriach. Każdy plik to jedna kategoria. Nazwa podgrupy jest podpowiedzią dla impostora:

```json
{
  "name": "Jedzenie",
  "emoji": "🍕",
  "groups": {
    "owoc": "jabłko, gruszka, banan",
    "warzywo": "marchewka, ziemniak"
  }
}
```
Nowa kategoria: dodaj plik i wpisz go do `words/index.json`. Słowa w rundach się nie powtarzają, dopóki pula się nie wyczerpie (pamięta to telefon).

## Telewizor z przeglądarką (bez laptopa)
Na telewizorze otwórz przeglądarkę i wpisz **`vcbgf5.github.io/Impostorgame/tv`** (albo sam adres główny i kliknij „📺 To jest telewizor”). Na ekranie pojawi się kod i QR. Telefon hosta skanuje QR i gotowe.
Uwaga: przeglądarka telewizora musi obsługiwać WebRTC. Nowsze telewizory z Androidem/Google TV (Chrome), LG webOS i Samsung Tizen zwykle obsługują. Jeśli kod stoi na „łączenie…”, użyj laptopa albo przystawki z Chrome.

## Uruchomienie na GitHub Pages
1. Wrzuć cały folder do repozytorium na GitHubie.
2. *Settings → Pages → Deploy from branch → `main` / root*.
3. Gra będzie pod `https://TWOJ-LOGIN.github.io/NAZWA-REPO/` (telefon), a ekran TV pod `.../tv.html` (laptop).

Lokalnie (na tym samym komputerze, do testów):
```bash
python3 -m http.server 8000
```
Potem otwórz `http://localhost:8000/index.html` i przycisk „Test: ekran TV w nowej karcie”. Karty w tej samej przeglądarce łączą się bez internetu.

## Pliki
- `index.html`, `js/host.js`, `css/host.css` – aplikacja hosta (telefon)
- `tv.html`, `js/tv.js`, `css/tv.css` – ekran telewizora
- `js/config.js` – ustawienia (źródło słów, prefiks połączenia)
- `js/vendor/` – PeerJS (MIT) i qrcode-generator (MIT)
- `words/` – baza słów
