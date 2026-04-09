# Babun CRM

## Project Overview
Babun — CRM-система, построенная на платформе Bumpix.
Основная цель: управление клиентами, сделками, задачами и аналитикой.

## Tech Stack
- **Platform**: Bumpix (исследуется через Playwright)
- **Frontend**: React / Next.js + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Motion (Framer Motion) + GSAP (при необходимости)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Deployment**: Vercel
- **UI Components**: 21st.dev Magic components

## Architecture Principles
- Модульная архитектура: каждый модуль CRM — отдельная папка
- Server Components по умолчанию, Client Components только когда нужна интерактивность
- API routes через Next.js App Router
- Supabase для всех CRUD операций и real-time подписок
- Row Level Security (RLS) в Supabase для безопасности данных

## CRM Modules (planned)
1. **Dashboard** — главная панель с метриками и графиками
2. **Contacts** — управление контактами (клиенты, лиды, компании)
3. **Deals** — воронка продаж, сделки, этапы
4. **Tasks** — задачи, напоминания, календарь
5. **Analytics** — отчёты, графики, KPI
6. **Settings** — настройки пользователя и системы
7. **Communications** — email, звонки, заметки

## Code Conventions
- Язык кода: English (переменные, функции, компоненты)
- Язык UI: Русский (интерфейс для русскоязычных пользователей)
- Файловая структура: feature-based (по модулям)
- Именование: camelCase для переменных, PascalCase для компонентов
- Импорты: абсолютные пути через `@/` alias

## MCP Servers
- **Playwright** — исследование Bumpix, тестирование UI
- **Memory** — хранение контекста между сессиями
- **Sequential Thinking** — сложное планирование и архитектура
- **Magic (21st.dev)** — готовые UI компоненты
- **Context7** — документация библиотек
- **Vercel** — деплой и управление проектом
- **Supabase** — база данных (TBD)

## Development Workflow
1. Исследовать Bumpix через Playwright
2. Спроектировать схему БД
3. Создать базовую структуру проекта
4. Реализовать модули поэтапно
5. Тестировать через Playwright
6. Деплоить через Vercel
