#!/usr/bin/env bash
# Kolejka zadan dla Codexa: uruchamia codex exec po kolei (jeden naraz na ten katalog).
# Uzycie: bash narzedzia/codex_kolejka.sh 04 06 05   (numery plikow narzedzia/zadania/NN-*.md)
C="/c/Users/pc/AppData/Local/OpenAI/Codex/bin/80f78947ad880e6e/codex.exe"
KAT="C:\Users\pc\Desktop\studio"
cd "$(dirname "$0")/.." || exit 1
czekaj_na_wolny() {
  while powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"name='codex.exe'\" | Where-Object { \$_.CommandLine -like '*exec -C*studio*' }) { exit 1 } else { exit 0 }"; [ $? -ne 0 ]; do sleep 20; done
}
for nr in "$@"; do
  plik=$(ls narzedzia/zadania/${nr}-*.md 2>/dev/null | grep -v wynik | head -1)
  [ -z "$plik" ] && { echo "brak zadania $nr"; continue; }
  czekaj_na_wolny
  echo "== $(date +%H:%M) start $plik"
  "$C" exec -C "$KAT" -s workspace-write --skip-git-repo-check -m gpt-6-astra -c 'model_reasoning_effort="medium"' --json \
    -o "$KAT\narzedzia\zadania\${nr}-wynik-codex.txt" \
    "Wykonaj w całości zadanie z pliku ${plik} (przeczytaj je i AGENTS.md oraz narzedzia/DYSKUSJA.md). Nie masz sieci: nie czytaj dokumentacji online i nie wołaj API. Pisz pliki od razu i zapisuj po każdym. Na końcu uruchom test, jeśli zadanie go przewiduje, i dopisz wynik do pliku zadania. Odpowiedz po polsku, krótko." \
    < /dev/null > "narzedzia/zadania/${nr}-codex-log.jsonl" 2>&1
  echo "== $(date +%H:%M) koniec $plik (exit $?)"
  cat "narzedzia/zadania/${nr}-wynik-codex.txt" 2>/dev/null | head -8
done
