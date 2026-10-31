# 🕵️ Impostor – gra imprezowa na jeden telefon + telewizor

Jeden telefon (host) krąży między graczami, a laptop podłączony do telewizora pokazuje lobby, instrukcje, czyja jest kolej, odliczanie, głosowanie, wyniki i animacje.

## Jak to działa

1. **Laptop + TV**: otwórz `tv.html` (F11 = pełny ekran). Laptop podłączasz kablem HDMI albo w Chrome wybierasz *⋮ → Przesyłaj → Przesyłaj kartę* na Chromecasta. Na ekranie pojawi się **kod (np. `KAE4`) i QR**.
2. **Telefon hosta**: zeskanuj QR albo otwórz `index.html` i wpisz kod. Telefon łączy się z laptopem przez WebRTC (PeerJS). Nie trzeba konta, rejestracji ani aplikacji na telewizorze. Oba urządzenia potrzebują internetu.
3. Host dodaje graczy (kolejność = kolejność podawania telefonu), wybiera kategorie i zasady.
4. **Rozdawanie ról**: telewizor pokazuje, komu podać telefon. Gracz klika „To ja”, **przytrzymuje kafelek** (kafelek się podnosi i widać słowo), puszcza go, klika „Podaj dalej”.
   - Załoga widzi słowo i kategorię.
   - Impostor widzi „JESTEŚ IMPOSTOREM” i, jeśli host włączył podpowiedź, ogólne hasło (np. słowo „banan” → podpowiedź „owoc”).
5. **Dyskusja**: z czasem (1–5 min) albo bez limitu. Na TV jest odliczanie i kolejność mówienia. Opcja „Ktoś zapomniał słowa?” pozwala komuś podejrzeć słowo jeszcze raz.
6. **Głosowanie** (domyślnie 30 s): na trzy wszyscy wskazują podejrzanego, a host zaznacza przy każdym graczu, kogo wskazał. Na TV na żywo rosną paski z awatarami głosujących.
7. **Wynik**: werbel → kogo wyrzucono → pieczątka „BYŁ / NIE BYŁ IMPOSTOREM” → na TV pojawia się 10 słów (prawdziwe + 9 podobnych z tej samej grupy), impostor wybiera jedno, a host zaznacza je na telefonie → słowo na TV → punkty → tabela.

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
Na telewizorze otwórz przeglądarkę i wpisz **`vcbgf5.github.io/impostorgame/tv`** (albo sam adres główny i kliknij „📺 To jest telewizor”). Na ekranie pojawi się kod i QR. Telefon hosta skanuje QR i gotowe.
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
