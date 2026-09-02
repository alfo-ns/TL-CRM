# Vendite CRM

CRM da tavolo (desktop-style) per la gestione del processo di vendita outbound, da lanciare in locale su Windows. Nessuna dipendenza cloud: backend Python/Flask, interfaccia web servita su `localhost`, dati in un unico file SQLite.

Pipeline a 8 stadi (Prospect grezzo → Lead → Contattato → Qualificato → Proposta inviata → Negoziazione → Vinto/Perso), vista Kanban con drag & drop, Planner con corsie di urgenza e calendario, Contatti (vista Persone/Aziende), Bridge contact, dossier di profilazione per persona, dashboard KPI con imbuto di vendita e tempi medi per stadio.

## Requisiti

- Windows 10/11 (o qualsiasi OS con Python 3.10+; lo script di avvio incluso è per Windows)
- [Python 3.10 o superiore](https://www.python.org/downloads/) — durante l'installazione seleziona **"Add python.exe to PATH"**
- Un browser (si apre automaticamente all'avvio)

## Avvio rapido

1. Estrai/copia la cartella `crm/` dove preferisci (anche su una chiavetta o cartella locale — non serve che sia sulla rete).
2. Fai doppio click su **`avvia.bat`**.
   - La prima volta crea un ambiente virtuale Python (`.venv`) e installa le dipendenze da `requirements.txt` (serve una connessione internet solo per questo primo passaggio, se `pip` deve scaricare Flask).
   - Poi avvia il server locale e apre automaticamente il browser su `http://127.0.0.1:5000`.
3. Per chiudere il programma, chiudi la finestra del terminale (o premi `CTRL+C`).

Al primo avvio il database viene creato con dati dimostrativi precaricati (aziende, contatti, bridge contact) così puoi subito esplorare l'interfaccia. Cancella il file del database (vedi sotto) per ripartire da zero.

## Dove viene salvato il database

Di default il file del database è `crm/data/crm.db`. Per usare un percorso diverso — **ad esempio una cartella di rete condivisa così più postazioni vedono gli stessi dati** — crea un file `config.json` nella cartella `crm/` (puoi partire da `config.example.json`):

```json
{
  "db_path": "Z:\\CRM\\crm.db",
  "host": "127.0.0.1",
  "port": 5000,
  "open_browser": true
}
```

In alternativa puoi impostare un file `.env` (stesso formato di un file `.env` qualsiasi, `CHIAVE=valore` una per riga) o una variabile d'ambiente di sistema:

```
CRM_DB_PATH=Z:\CRM\crm.db
```

Ordine di priorità: variabile d'ambiente `CRM_DB_PATH` → `.env` → `config.json` → default (`crm/data/crm.db`).

**Ogni PC che deve lavorare sugli stessi dati va configurato con lo stesso percorso di rete** (`db_path`), e ogni postazione lancia comunque la propria copia di `avvia.bat`/dell'app — non è un server centralizzato, è più PC che aprono lo stesso file.

## Accesso multi-utente e concorrenza

Il database SQLite è aperto in **modalità WAL** (Write-Ahead Logging), con timeout e retry automatico con backoff sui salvataggi in caso il file risulti temporaneamente bloccato da un altro utente. Questo copre bene il caso tipico di due persone che salvano quasi nello stesso istante.

**Avvertenza importante:** SQLite in modalità WAL è pensato per un singolo filesystem locale; l'uso su una cartella di rete (SMB/CIFS, mappata come `Z:\`) **non è ufficialmente garantito da SQLite** in tutte le configurazioni di rete, perché la modalità WAL si appoggia a primitive di blocco file che alcuni server/driver di rete non implementano in modo completamente affidabile. Nella pratica funziona bene sulla maggior parte delle reti aziendali Windows, ma:

- fai backup periodici del file `.db` (bastano una copia programmata o manuale);
- se nella tua rete noti errori "database is locked" persistenti o comportamenti strani con più utenti simultanei, valuta di ridurre il numero di scritture concorrenti (es. un solo "operatore di turno" alla volta) oppure di spostare il database su un piccolo server centrale che esponga questa stessa app via rete (un solo processo Flask, più browser puntati a quell'indirizzo) invece che più processi che aprono lo stesso file — è un cambiamento semplice se necessario, chiedi pure supporto per impostarlo.

## Struttura del progetto

```
crm/
  app.py            punto di ingresso: avvia il server e apre il browser
  config.py         lettura di config.json / .env / variabili d'ambiente
  db.py             connessione SQLite (WAL, retry, transazioni)
  schema.sql         schema del database
  seed.py            dati dimostrativi caricati al primo avvio
  constants.py        stadi della pipeline e tipi di azione (fissi)
  requirements.txt
  avvia.bat
  templates/index.html
  static/css/style.css
  static/js/          logica applicativa (nessun framework, nessuna dipendenza da CDN)
  data/                cartella di default per il file crm.db (creata al primo avvio)
```

## Note

- L'interfaccia è scritta in HTML/CSS/JS "vanilla", senza framework né librerie esterne: funziona interamente offline dopo l'installazione delle dipendenze Python.
- Gli stadi della pipeline e i tipi di azione (LinkedIn, Email, Call, ecc.) sono fissi in questa versione, come nel prototipo di partenza. Gli operatori ("Portato da" / "In gestione a") si gestiscono invece dalla sezione **Impostazioni**.
