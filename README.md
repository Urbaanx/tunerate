# tunerate

## Wymagania wstępne

Aby uruchomić projekt lokalnie, na komputerze muszą być zainstalowane następujące narzędzia:

- **Node.js**: https://nodejs.org/en/download
- **Git**: https://git-scm.com/install/windows
- **Docker**: https://www.docker.com/
- **.NET**: https://dotnet.microsoft.com/en-us/download

## Instalacja i konfiguracja

### Krok 1: Klonowanie repozytorium

```bash
git clone https://github.com/Urbaanx/tunerate.git
cd tunerate
```

### Krok 2: Uruchomienie Serwisu Rekomendacji oraz bazy danych

Po instalacji Dockera należy uruchomić go, przejść do katalogu `recommendation-service` oraz uruchomić serwis poleceniem `docker compose up --build -d`

```bash
cd recommendation-service
docker compose up --build -d
```

Serwis razem z bazą danych uruchomi się po pełnej instalacji oraz konfiguracji środowiska.

### Krok 3: Uruchomienie Backendu

Po instalacji .NET należy zainstalować narzędzia dla Entity Framework Core.

```bash
cd api
dotnet tool install --global dotnet-ef
```

Następnie przywracamy pakiety API oraz budujemy je.

```bash
dotnet restore
dotnet build
```

Następnie tworzymy tabele w bazie danych, utworzonej wcześniej w serwisie rekomendacji, wykorzystując migrację.

```bash
dotnet ef database update
```

Aby dodać dane do bazy danych wchodzimy na stronę `http://localhost:8080` (działa po wczesniejszym uruchomieniu serwisu rekomendacji oraz bazy danych), wybieramy rodzaj bazy `PostgreSQL`, w użytkownik wpisujemy `dbuser`, hasło `dbpassword` oraz baze danych `tunerate_db`. Po zalogowaniu się wybieramy w panelu po lewej stronie opcję `Importuj`, klikamy `Przeglądaj...` i wybieramy plik `db_dump.sql` z katalogu `recommendation-service`, a następnie klikamy `Wykonaj`.

Po dodaniu danych do bazy uruchamiamy API.

```bash
dotnet run
```

### Krok 4: Uruchomienie Frontendu

```bash
# W nowym terminalu:
cd app

# Instalacja zależności
npm install

# Uruchomienie aplikacji
npm run dev
```

---

## Po uruchomieniu aplikacja będzie dostępna pod adresem `http://localhost:5173`
