# Lora Style Transfer

Frontendové demonстраční rozhraní pro stylové převody obrázků s mock daty, připravené na integraci s Cursor backendem.

## Klíčové vlastnosti (What it does)
- Frontend-only demo s mock daty a vizuálně bohatým UI pro stylové transfery
- Připravená architektura pro backend integraci Cursor a Convex schéma
- Kompletní Convex databázové schéma (modely, presets, results, processing_jobs, system_info)
- Připravené komponenty pro upload modelů, zpracování obrázků a správu presetů
- Komunikace v češtině
- Optimalizovaná velikost projektu: 7.4 MB (bez node_modules, bez cache)
- Neobsahuje skutečné AI modely — slouží jako struktura pro budoucí integraci
- Jasně připraveno pro push na GitHub aCursor development

## Proč (Why)
- Poskytuje rychlý, vizuálně bohatý frontend pro experimenty s neural-style transferem a pro snadnou budoucí výměnu mock dat za skutečnou AI logiku a backend
- Umožňuje iteraci UX a datových modelů nezávisle na backendu, aby Cursor vývojáři přesně věděli, co implementovat

## Stav projektu (Current State)
- Frontend-only demo s mock daty
- Backend API a Convex data lze integrovat pro rozšíření funkčnosti
- Struktura připravená pro backendovou logiku a GPU-backed zpracování

## Architektura (High-Level)
- Frontend komponenty: ImageUpload, ParameterControls, ModelManager, ResultsGallery, PresetManager, ProgressTracker, ErrorBoundary, a další
- Convex surface pro data (presets, models, results, processing history) s jasně definovanými mutacemi/queries
- Klientská logika pro správu modelů, parametrů, výsledků a průběhu zpracování
- Připravené Convex schéma a workflow pro budoucí propojení s backendem

## Convex databázové schéma (Conceptual)
- models: id, name, type (lora|full), fileSize, uploadedAt, isActive, metadata
- presets: id, userId (optional), name, parameters, isFavorite, createdAt, updatedAt
- results: id, imageUrl, seed, parameters, modelName, loraName, isFavorite, userId, createdAt
- processingJobs: id, userId, inputImageId, modelId, parameters, status, progress, currentStep, totalSteps, startedAt, completedAt, errorMessage, resultImageIds
- systemInfo: id, userId, hardwareInfo, lastUpdated

Poznámka: Tento Convex model slouží jako vytyčený rámec pro budoucí implementaci a může být upraven podle konečné backend architektury.

## Cursor a budoucí integrace (Cursor integration)
- Backend endpoints (předpokládané): /process, /status/{job_id}, /models, /health, /models/upload, /models/delete
- Mapování Convex schématu na backend data modely a zajištění konzistence ID
- Real-time aktualizace průběhu zpracování, progress bar a ETA
- End-to-end testy pro model upload, preset management, processing a výsledky

## Odkazy (Docs)
- CURSOR_DEVELOPMENT_GUIDE.md
- PROJECT_AUDIT.md

## Deployment a GitHub (Deployment & versioning)
- Projekt je připraven pro push na GitHub
- Struktura je front-end s mock daty, připravená pro Cursor development a Convex data layer

## Setup a vývoj (Development Setup)
- Vytvořte lokální prostředí pro frontend development (inicializujte projekt dle vašich standardů)
- Ujistěte se, že Convex surface (nebo ekvivalentní datová vrstva) je připravena pro vývoj
- Připravte mock data pro modely, presets a results tak, aby UI zobrazovalo strukturu bez scénářů reality
- Spusťte frontend v vývojovém režimu a ověřte protékající UI flow (nahrávání obrázků, volba modelů, úprava parametrů, ukládání presetů, zobrazení výsledků)
- Připravte environmentální proměnné pro backend URL a koncové body, aby bylo možné připravit Cursor integration

Note: Tento README je záměrně stručný a soustředí se na “co” a “proč” projektu, nikoliv na implementační detaily.

## Quick Start (V kostce)
- Otevřete aplikaci v připraveném vývojovém prostředí
- Nahrajte obrázek pomocí Upload
- Vyberte model (LoRA či plný) z katalogu
- Upravte parametry stylového transferu a uložte preset, pokud chcete
- Spusťte zpracování (mock)
- Prohlédněte a stáhněte výsledky, spravujte modely a presety podle potřeby

Pokud byste chtěli variantu pro konkrétní task nebo jedno-stránkový AI-oriented brief, připravím ji na míru.
